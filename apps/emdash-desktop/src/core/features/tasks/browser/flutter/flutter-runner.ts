import { ReplicaLog } from '@emdash/wire/live';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { getSearchClient } from '@core/features/search/api/client';
import type { PreviewServerStore } from '@core/features/tasks/api/browser/stores/preview-server-store';
import type { TerminalRuntimeKey } from '@core/features/terminals/api';
import { getTerminalsClient } from '@core/features/terminals/api/browser/client';
import type { TerminalManagerStore } from '@core/features/terminals/api/browser/task-terminal/terminal-manager';
import { log } from '@core/primitives/logging/browser/logger';
import {
  markerCommand,
  markerText,
  parseFlutterDevices,
  parseFlutterEmulators,
  sliceBetweenMarkers,
  stripAnsi,
  type FlutterDevice,
  type FlutterEmulator,
} from './flutter-output';

export type FlutterTargets = { devices: FlutterDevice[]; emulators: FlutterEmulator[] };

export type FlutterRunTarget =
  | { kind: 'device'; device: Pick<FlutterDevice, 'id' | 'name'> }
  | { kind: 'emulator'; emulator: FlutterEmulator };

type LastDevice = Pick<FlutterDevice, 'id' | 'name'>;

// ponytail: simulators/emulators only; drop these flags if wireless devices are ever needed.
const DEVICES_COMMAND = 'flutter devices --machine --device-connection attached --device-timeout 1';
const OUTPUT_LIMIT = 64_000;
const MARKER_OVERLAP = 64;
const EMULATOR_BOOT_POLLS = 40;
const EMULATOR_BOOT_POLL_MS = 3_000;
const DETECT_ATTEMPTS = 15;
const DETECT_RETRY_MS = 2_000;

// Same app lookup as flutter (DeviceHub on newer Xcode, else Simulator), minus its forced `-n`.
const IOS_SIMULATOR_OPEN =
  'open -a "$(dirname "$(xcode-select -p)")/Applications/DeviceHub.app" 2>/dev/null' +
  ' || open -a "$(xcode-select -p)/Applications/Simulator.app"';

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
const newToken = () => crypto.randomUUID().slice(0, 8);

/** Drives `flutter` in one hidden task terminal ("Flutter"): commands are typed into its shell
 * and their output is read back from the terminal's live log. */
export class FlutterRunner {
  isFlutter: boolean | null = null;
  phase: 'idle' | 'busy' | 'starting' | 'running' = 'idle';
  lastDevice: LastDevice | null;
  /** Last device list, shown instantly while a fresh one loads. */
  targets: FlutterTargets | null = null;
  private output = '';
  private terminalId: string | null = null;
  private key: TerminalRuntimeKey | null = null;
  private log: ReplicaLog | null = null;
  private runToken: string | null = null;
  private readonly listeners = new Set<() => void>();
  private detecting: Promise<void> | null = null;

  constructor(
    private readonly projectId: string,
    private readonly taskId: string,
    private readonly workspaceId: string,
    private readonly terminals: TerminalManagerStore,
    private readonly previewServers: PreviewServerStore
  ) {
    this.lastDevice = readLastDevice(projectId);
    makeObservable<FlutterRunner, 'onOutput'>(this, {
      isFlutter: observable,
      phase: observable,
      lastDevice: observable,
      targets: observable.ref,
      state: computed,
      onOutput: action,
    });
  }

  /** Closing the Flutter terminal ends the run. */
  get state(): FlutterRunner['phase'] {
    if (this.terminalId && !this.terminals.terminals.has(this.terminalId)) return 'idle';
    return this.phase;
  }

  /** The file index may still be building when the task opens, so a miss is retried. */
  detectFlutter(): Promise<void> {
    this.detecting ??= this.detect();
    return this.detecting;
  }

  private async detect(): Promise<void> {
    const client = await getSearchClient();
    for (let attempt = 0; attempt < DETECT_ATTEMPTS; attempt++) {
      const hits = await client
        .searchWorkspaceFiles({ workspaceId: this.workspaceId, query: 'pubspec.yaml', limit: 50 })
        .catch(() => []);
      if (hits.some((hit) => hit.relativePath === 'pubspec.yaml')) {
        runInAction(() => {
          this.isFlutter = true;
        });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, DETECT_RETRY_MS));
    }
    runInAction(() => {
      this.isFlutter = false;
    });
  }

  async refreshTargets(): Promise<void> {
    const targets = await this.busy(async () => ({
      devices: parseFlutterDevices(await this.exec(DEVICES_COMMAND)),
      emulators: parseFlutterEmulators(await this.exec('flutter emulators')),
    }));
    runInAction(() => {
      this.targets = targets;
    });
  }

  async run(target: FlutterRunTarget): Promise<void> {
    if (this.state === 'starting' || this.state === 'running') return;
    const device =
      target.kind === 'device' ? target.device : await this.busy(() => this.boot(target.emulator));
    const lastDevice = { id: device.id, name: device.name };
    runInAction(() => {
      this.lastDevice = lastDevice;
    });
    writeLastDevice(this.projectId, lastDevice);
    await this.ensureTerminal();
    const token = newToken();
    runInAction(() => {
      this.runToken = token;
      this.phase = 'starting';
    });
    await this.send(
      `${markerCommand('S', token)}; flutter run -d ${quote(device.id)}; ${markerCommand('X', token)}\r`
    );
  }

  /** `q` is only read once the app is attached. While building, Ctrl+C aborts the whole command
   * line, so the exit marker never prints and the run is ended here instead. */
  async stop(): Promise<void> {
    if (this.phase !== 'starting') return this.send('q');
    await this.send('\x03');
    runInAction(() => this.endRun());
  }

  hotRestart(): Promise<void> {
    return this.send('R');
  }

  private async boot(emulator: FlutterEmulator): Promise<FlutterDevice> {
    const before = new Set(parseFlutterDevices(await this.exec(DEVICES_COMMAND)).map((d) => d.id));
    // `flutter emulators --launch` on iOS runs `open -n` (forced new app instance) then `open`,
    // which opens a second simulator window when one is already up; plain `open -a` reuses it.
    await this.exec(
      emulator.platform === 'ios'
        ? IOS_SIMULATOR_OPEN
        : `flutter emulators --launch ${quote(emulator.id)}`
    );
    for (let attempt = 0; attempt < EMULATOR_BOOT_POLLS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, EMULATOR_BOOT_POLL_MS));
      const booted = parseFlutterDevices(await this.exec(DEVICES_COMMAND)).find(
        (d) => d.emulator && !before.has(d.id) && d.platform.startsWith(emulator.platform)
      );
      if (booted) return booted;
    }
    throw new Error(`${emulator.name} did not boot in time`);
  }

  private async busy<T>(work: () => Promise<T>): Promise<T> {
    runInAction(() => {
      this.phase = 'busy';
    });
    try {
      return await work();
    } finally {
      runInAction(() => {
        if (this.phase === 'busy') this.phase = 'idle';
      });
    }
  }

  /** Types `command` into the Flutter terminal and resolves with its output. */
  private async exec(command: string): Promise<string> {
    await this.ensureTerminal();
    const token = newToken();
    const done = new Promise<string>((resolve) => {
      const check = () => {
        const out = sliceBetweenMarkers(this.output, token);
        if (out === null) return;
        this.listeners.delete(check);
        resolve(out);
      };
      this.listeners.add(check);
    });
    await this.send(`${markerCommand('B', token)}; ${command}; ${markerCommand('E', token)}\r`);
    return done;
  }

  private async ensureTerminal(): Promise<void> {
    if (this.terminalId && this.terminals.terminals.has(this.terminalId) && this.key) return;
    const id = crypto.randomUUID();
    await this.terminals.createTerminal({
      id,
      projectId: this.projectId,
      taskId: this.taskId,
      name: 'Flutter',
    });
    const key = this.terminals.runtimeKeys.get(id);
    if (!key) throw new Error('Flutter terminal did not start');
    void this.log?.dispose();
    this.terminalId = id;
    this.key = key;
    this.output = '';
    this.log = new ReplicaLog((await getTerminalsClient()).output.handle(key), {
      store: {
        reset: (data) => this.onOutput(data.text, true),
        append: (chunk) => this.onOutput(chunk, false),
      },
    });
    await this.log.ready;
  }

  private onOutput(chunk: string, reset: boolean): void {
    const text = stripAnsi(chunk);
    this.output = ((reset ? '' : this.output) + text).slice(-OUTPUT_LIMIT);
    for (const listener of [...this.listeners]) listener();
    if (!this.runToken) return;
    const recent = reset ? this.output : this.output.slice(-(text.length + MARKER_OVERLAP));
    if (recent.includes(markerText('X', this.runToken))) {
      this.endRun();
      return;
    }
    if (this.phase === 'running') return;
    const start = this.output.indexOf(markerText('S', this.runToken));
    if (start === -1) return;
    if (this.output.includes('Flutter run key commands', start)) this.phase = 'running';
  }

  private endRun(): void {
    this.runToken = null;
    this.phase = 'idle';
    this.clearPreviews();
  }

  /** The shell outlives `flutter run`, so its DevTools preview pill is not dropped on its own. */
  private clearPreviews(): void {
    for (const server of this.previewServers.servers) {
      if (server.source.kind !== 'terminal-output') continue;
      if (server.source.terminalId !== this.terminalId) continue;
      this.previewServers
        .stop(server.id)
        .catch((error) => log.warn('Clearing Flutter preview failed', { error }));
    }
  }

  private async send(data: string): Promise<void> {
    if (!this.key) return;
    await (await getTerminalsClient()).sendInput({ ...this.key, data });
  }
}

// ponytail: one runner per task for the app's lifetime; dispose with the task if it ever matters.
const runners = new Map<string, FlutterRunner>();

export function getFlutterRunner(
  projectId: string,
  taskId: string,
  workspaceId: string,
  terminals: TerminalManagerStore,
  previewServers: PreviewServerStore
): FlutterRunner {
  let runner = runners.get(taskId);
  if (!runner) {
    runner = new FlutterRunner(projectId, taskId, workspaceId, terminals, previewServers);
    runners.set(taskId, runner);
  }
  return runner;
}

const lastDeviceKey = (projectId: string) => `emdash.flutter.lastDevice.${projectId}`;

function readLastDevice(projectId: string): LastDevice | null {
  try {
    const raw = localStorage.getItem(lastDeviceKey(projectId));
    return raw ? (JSON.parse(raw) as LastDevice) : null;
  } catch {
    return null;
  }
}

/** Remembering the device is a convenience only, so storage failures are ignored. */
function writeLastDevice(projectId: string, device: LastDevice): void {
  try {
    localStorage.setItem(lastDeviceKey(projectId), JSON.stringify(device));
  } catch {
    return;
  }
}
