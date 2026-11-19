import { ReplicaLog } from '@emdash/wire/live';
import { action, computed, makeObservable, observable, runInAction, when } from 'mobx';
import { getSearchClient } from '@core/features/search/api/client';
import type { PreviewServerStore } from '@core/features/tasks/api/browser/stores/preview-server-store';
import type { TerminalRuntimeKey } from '@core/features/terminals/api';
import { getTerminalsClient } from '@core/features/terminals/api/browser/client';
import type { TerminalManagerStore } from '@core/features/terminals/api/browser/task-terminal/terminal-manager';
import { log } from '@core/primitives/logging/browser/logger';
import {
  markerCommand,
  markerText,
  openRunToken,
  parseDaemonLine,
  DAEMON_EMULATORS_REQUEST_ID,
  type DaemonUpdate,
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

/** `run` skips DDS and its DevTools server (one less Dart process); hot reload/restart still work.
 * Simulators only build debug mode, so this is the lighter option there. */
export type FlutterRunMode = 'run' | 'debug';

const DAEMON_TERMINAL = 'Flutter Devices';
const DAEMON_START_REQUESTS =
  '[{"id":1,"method":"device.enable"}]\r' +
  `[{"id":${DAEMON_EMULATORS_REQUEST_ID},"method":"emulator.getEmulators"}]\r`;
const OUTPUT_LIMIT = 64_000;
const MARKER_OVERLAP = 64;
const EMULATOR_BOOT_TIMEOUT_MS = 120_000;
const AUTO_SELECT_SETTLE_MS = 2_000;
const DETECT_ATTEMPTS = 15;
const DETECT_RETRY_MS = 2_000;

// Same app lookup as flutter (DeviceHub on newer Xcode, else Simulator), minus its forced `-n`.
const IOS_SIMULATOR_OPEN =
  'open -a "$(dirname "$(xcode-select -p)")/Applications/DeviceHub.app" 2>/dev/null' +
  ' || open -a "$(xcode-select -p)/Applications/Simulator.app"';

/** Where this run's output begins in a replayed log. Past OUTPUT_LIMIT the start marker is gone,
 * so fall back to just after the last run's exit marker (or the whole buffer). */
function runStart(output: string, startMarker: string): number {
  const start = output.indexOf(startMarker);
  if (start !== -1) return start;
  const last = [...output.matchAll(/@@X1_[\w-]+@@/g)].at(-1);
  return last?.index === undefined ? 0 : last.index + last[0].length;
}

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
const newToken = () => crypto.randomUUID().slice(0, 8);

/** Drives `flutter` in one hidden task terminal ("Flutter"): commands are typed into its shell
 * and their output is read back from the terminal's live log. */
export class FlutterRunner {
  isFlutter: boolean | null = null;
  phase: 'idle' | 'busy' | 'starting' | 'running' = 'idle';
  lastDevice: LastDevice | null;
  mode: FlutterRunMode;
  /** Last device list, shown instantly while a fresh one loads. */
  targets: FlutterTargets | null = null;
  private output = '';
  /** The "Flutter" terminal commands are typed into, once created. */
  terminalId: string | null = null;
  private key: TerminalRuntimeKey | null = null;
  private log: ReplicaLog | null = null;
  private runToken: string | null = null;
  private readonly listeners = new Set<() => void>();
  private detecting: Promise<void> | null = null;
  /** `flutter daemon` terminal streaming device changes, while this task's picker watches. */
  private daemonId: string | null = null;
  private daemonLog: ReplicaLog | null = null;
  private daemonLine = '';
  private autoSelectTimer: ReturnType<typeof setTimeout> | undefined;
  /** Devices a restarted daemon has listed so far; the previous list stays on screen until it
   * settles, then whatever it did not list (shut down meanwhile) is dropped. */
  private relisted: Set<string> | null = null;
  /** Overlapping busy work (device refresh while an emulator boots) must not end `busy` early. */
  private busyCount = 0;

  constructor(
    private readonly projectId: string,
    private readonly taskId: string,
    private readonly workspaceId: string,
    private readonly terminals: TerminalManagerStore,
    private readonly previewServers: PreviewServerStore
  ) {
    this.lastDevice = readLastDevice(projectId);
    this.mode = readPref(modeKey(projectId)) === 'debug' ? 'debug' : 'run';
    makeObservable<FlutterRunner, 'onOutput'>(this, {
      isFlutter: observable,
      phase: observable,
      lastDevice: observable,
      mode: observable,
      setMode: action,
      targets: observable.ref,
      state: computed,
      onlineDevice: computed,
      onOutput: action,
    });
  }

  /** Closing the Flutter terminal ends the run. */
  get state(): FlutterRunner['phase'] {
    if (this.terminalId && !this.terminals.terminals.has(this.terminalId)) return 'idle';
    return this.phase;
  }

  /** The remembered device, but only while `flutter devices` lists it (booted / plugged in). */
  get onlineDevice(): FlutterDevice | null {
    const id = this.lastDevice?.id;
    return this.targets?.devices.find((d) => d.id === id) ?? null;
  }

  /** The file index may still be building when the task opens, so a miss is retried. */
  detectFlutter(): Promise<void> {
    this.detecting ??= this.detect()
      .then(() => (this.isFlutter ? this.adopt() : undefined))
      .catch((error: unknown) => {
        this.detecting = null;
        throw error;
      });
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

  /** A renderer reload drops this runner, but the "Flutter" terminal and its `flutter run` live on
   * in the main process: reattach so the run state is read back from its log. */
  private async adopt(): Promise<void> {
    await when(() => this.terminals.isLoaded);
    const existing = [...this.terminals.terminals.values()].find((t) => t.data.name === 'Flutter');
    if (this.terminalId || !existing) return;
    await this.terminals.hydrateTerminal(existing.data.id);
    if (!this.terminalId) await this.attach(existing.data.id);
  }

  setMode(mode: FlutterRunMode): void {
    this.mode = mode;
    writePref(modeKey(this.projectId), mode);
  }

  /** Streams devices from `flutter daemon` (as VS Code does), so booting or shutting down a
   * simulator shows up at once. One daemon app-wide (~150MB Dart process): watching from another
   * task stops the previous one. A daemon left from before a renderer reload is replaced. */
  async watchDevices(): Promise<void> {
    if (
      watchingTaskId === this.taskId &&
      (!this.daemonId || this.terminals.terminals.has(this.daemonId))
    )
      return;
    const previous = watchingTaskId === null ? undefined : runners.get(watchingTaskId);
    watchingTaskId = this.taskId;
    await previous?.unwatchDevices();
    await when(() => this.terminals.isLoaded);
    for (const terminal of [...this.terminals.terminals.values()]) {
      if (terminal.data.name === DAEMON_TERMINAL)
        await this.terminals.deleteTerminal(terminal.data.id);
    }
    const id = crypto.randomUUID();
    await this.terminals.createTerminal({
      id,
      projectId: this.projectId,
      taskId: this.taskId,
      name: DAEMON_TERMINAL,
    });
    const key = this.terminals.runtimeKeys.get(id);
    if (!key) throw new Error('Flutter devices terminal did not start');
    this.daemonId = id;
    this.daemonLine = '';
    this.daemonLog = new ReplicaLog((await getTerminalsClient()).output.handle(key), {
      store: {
        reset: (data) => this.onDaemonOutput(key, data.text, true),
        append: (chunk) => this.onDaemonOutput(key, chunk, false),
      },
    });
    await this.daemonLog.ready;
    // `exec`: the daemon replaces the shell, so closing the tab or the daemon ends both.
    await (await getTerminalsClient()).sendInput({ ...key, data: 'exec flutter daemon\r' });
    if (watchingTaskId !== this.taskId) await this.unwatchDevices();
  }

  private async unwatchDevices(): Promise<void> {
    void this.daemonLog?.dispose();
    this.daemonLog = null;
    const id = this.daemonId;
    this.daemonId = null;
    if (id) await this.terminals.deleteTerminal(id);
  }

  /** Only whole lines are parsed and only the unfinished one is kept, so the stream costs no
   * buffer growth. */
  private onDaemonOutput(key: TerminalRuntimeKey, chunk: string, reset: boolean): void {
    const lines = ((reset ? '' : this.daemonLine) + stripAnsi(chunk)).split('\n');
    this.daemonLine = lines.pop() ?? '';
    for (const line of lines) {
      const update = parseDaemonLine(line.trim());
      if (update) this.applyDaemonUpdate(key, update);
    }
  }

  private applyDaemonUpdate(key: TerminalRuntimeKey, update: DaemonUpdate): void {
    if (update.kind === 'connected') {
      this.relisted = new Set();
      void getTerminalsClient()
        .then((client) => client.sendInput({ ...key, data: DAEMON_START_REQUESTS }))
        .catch((error: unknown) => log.warn('Starting Flutter device watch failed', { error }));
      return;
    }
    const devices = this.targets?.devices ?? [];
    const emulators = this.targets?.emulators ?? [];
    runInAction(() => {
      if (update.kind === 'emulators') {
        this.targets = { devices, emulators: update.emulators };
        return;
      }
      const others = devices.filter(
        (d) => d.id !== (update.kind === 'added' ? update.device.id : update.id)
      );
      this.targets = {
        devices: update.kind === 'added' ? [...others, update.device] : others,
        emulators,
      };
    });
    // Settle first: the daemon lists every open device at startup, and the remembered one may
    // arrive after another phone that would otherwise be picked.
    if (update.kind === 'added') this.relisted?.add(update.device.id);
    clearTimeout(this.autoSelectTimer);
    this.autoSelectTimer = setTimeout(() => this.autoSelect(), AUTO_SELECT_SETTLE_MS);
  }

  /** Follows the simulator the user opens or closes: when the remembered device is offline, the
   * device that just came up (else any online phone) becomes the target. An online remembered
   * device and a run in progress are never switched. */
  private autoSelect(): void {
    const relisted = this.relisted;
    this.relisted = null;
    if (relisted && this.targets) {
      const { devices, emulators } = this.targets;
      runInAction(() => {
        this.targets = { devices: devices.filter((d) => relisted.has(d.id)), emulators };
      });
    }
    if (this.onlineDevice || this.phase !== 'idle') return;
    const isPhone = (d: FlutterDevice) => /^(ios|android)/.test(d.platform);
    // Devices are appended as they come up, so the last phone is the newest.
    const next = this.targets?.devices.filter(isPhone).at(-1);
    if (next) void this.selectTarget({ kind: 'device', device: next });
  }

  /** Makes `target` the remembered device, booting an offline emulator first. */
  async selectTarget(target: FlutterRunTarget): Promise<LastDevice> {
    const device =
      target.kind === 'device' ? target.device : await this.busy(() => this.boot(target.emulator));
    const lastDevice = { id: device.id, name: device.name };
    runInAction(() => {
      this.lastDevice = lastDevice;
    });
    writeLastDevice(this.projectId, lastDevice);
    return lastDevice;
  }

  async run(target: FlutterRunTarget): Promise<void> {
    if (this.state === 'starting' || this.state === 'running') return;
    const device = await this.selectTarget(target);
    await this.ensureTerminal();
    const token = newToken();
    runInAction(() => {
      this.runToken = token;
      this.phase = 'starting';
    });
    await this.send(
      `${markerCommand('S', token)}; flutter run -d ${quote(device.id)}${this.mode === 'run' ? ' --no-dds' : ''}; ${markerCommand('X', token)}\r`
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
    const before = new Set(this.targets?.devices.map((d) => d.id));
    const booted = () =>
      this.targets?.devices.find(
        (d) => d.emulator && !before.has(d.id) && d.platform.startsWith(emulator.platform)
      );
    // `flutter emulators --launch` on iOS runs `open -n` (forced new app instance) then `open`,
    // which opens a second simulator window when one is already up; plain `open -a` reuses it.
    await this.exec(
      emulator.platform === 'ios'
        ? IOS_SIMULATOR_OPEN
        : `flutter emulators --launch ${quote(emulator.id)}`
    );
    // The daemon reports the booted device; no polling.
    await when(() => !!booted(), { timeout: EMULATOR_BOOT_TIMEOUT_MS }).catch(() => undefined);
    const device = booted();
    if (!device) throw new Error(`${emulator.name} did not boot in time`);
    return device;
  }

  private async busy<T>(work: () => Promise<T>): Promise<T> {
    runInAction(() => {
      this.busyCount++;
      this.phase = 'busy';
    });
    try {
      return await work();
    } finally {
      runInAction(() => {
        if (--this.busyCount === 0 && this.phase === 'busy') this.phase = 'idle';
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
    await this.attach(id);
  }

  private async attach(id: string): Promise<void> {
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
    if (reset && !this.runToken) {
      this.runToken = openRunToken(this.output);
      if (this.runToken) this.phase = 'starting';
    }
    if (!this.runToken) return;
    const recent = reset ? this.output : this.output.slice(-(text.length + MARKER_OVERLAP));
    if (recent.includes(markerText('X', this.runToken))) {
      this.endRun();
      return;
    }
    if (this.phase === 'running') return;
    // Appends are scanned on their own: a long build's spinner output can push the start marker
    // past OUTPUT_LIMIT. Only a replayed log needs the marker to skip earlier runs.
    const start = reset ? runStart(this.output, markerText('S', this.runToken)) : 0;
    if ((reset ? this.output : recent).includes('Flutter run key commands', start)) {
      this.phase = 'running';
    }
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

/** Task whose runner runs the one `flutter daemon`. */
let watchingTaskId: string | null = null;

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
const modeKey = (projectId: string) => `emdash.flutter.mode.${projectId}`;

function readLastDevice(projectId: string): LastDevice | null {
  try {
    const raw = readPref(lastDeviceKey(projectId));
    return raw ? (JSON.parse(raw) as LastDevice) : null;
  } catch {
    return null;
  }
}

function writeLastDevice(projectId: string, device: LastDevice): void {
  writePref(lastDeviceKey(projectId), JSON.stringify(device));
}

/** Device and mode are conveniences only, so storage failures are ignored. */
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}
