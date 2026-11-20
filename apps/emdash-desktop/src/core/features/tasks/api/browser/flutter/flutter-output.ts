export type FlutterDevice = { id: string; name: string; platform: string; emulator: boolean };
export type FlutterEmulator = { id: string; name: string; platform: string };

const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]|\r/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/** Prints `@@<name>1_<token>@@`; the echoed command shows `$((1))`, so only real output matches. */
export function markerCommand(name: string, token: string): string {
  return `printf '\\n%s\\n' "@@${name}$((1))_${token}@@"`;
}

export function markerText(name: string, token: string): string {
  return `@@${name}1_${token}@@`;
}

/** Output printed between the `B` and `E` markers of one exec, or null while still running. */
export function sliceBetweenMarkers(text: string, token: string): string | null {
  const marker = markerText('B', token);
  const begin = text.indexOf(marker);
  if (begin === -1) return null;
  const end = text.indexOf(markerText('E', token), begin);
  return end === -1 ? null : text.slice(begin + marker.length, end);
}

/** Token of a run still in progress in a replayed log: last start marker with no exit marker and
 * no `^C` after it (Ctrl+C aborts the command line before the exit marker prints). */
export function openRunToken(output: string): string | null {
  const last = [...output.matchAll(/@@S1_([\w-]+)@@/g)].at(-1);
  if (!last || last.index === undefined) return null;
  const after = output.slice(last.index);
  return after.includes(markerText('X', last[1])) || after.includes('^C') ? null : last[1];
}

type DaemonDevice = {
  id: string;
  name: string;
  platform: string;
  emulator: boolean;
  connectionInterface?: string;
};

/** One `flutter daemon` stdout line (`[{...}]`) as the change it makes to the device list. Other
 * lines (echoed input, log messages, responses to other requests) give null. */
export type DaemonUpdate =
  | { kind: 'connected' }
  | { kind: 'added'; device: FlutterDevice }
  | { kind: 'removed'; id: string }
  | { kind: 'emulators'; emulators: FlutterEmulator[] };

export const DAEMON_EMULATORS_REQUEST_ID = 2;

export function parseDaemonLine(line: string): DaemonUpdate | null {
  if (!line.startsWith('[{')) return null;
  let message: { event?: string; params?: DaemonDevice; id?: number; result?: unknown };
  try {
    [message] = JSON.parse(line) as [typeof message];
  } catch {
    return null;
  }
  if (message.event === 'daemon.connected') return { kind: 'connected' };
  const device = message.params;
  if (message.event === 'device.removed' && device) return { kind: 'removed', id: device.id };
  // ponytail: attached only (simulators, emulators, cabled phones), like the old device list.
  if (message.event === 'device.added' && device && device.connectionInterface !== 'wireless') {
    const { id, name, platform, emulator } = device;
    return { kind: 'added', device: { id, name, platform, emulator } };
  }
  if (message.id === DAEMON_EMULATORS_REQUEST_ID && Array.isArray(message.result)) {
    const raw = message.result as Array<{ id: string; name: string; platformType: string }>;
    return {
      kind: 'emulators',
      emulators: raw.map((e) => ({ id: e.id, name: e.name, platform: e.platformType })),
    };
  }
  return null;
}
