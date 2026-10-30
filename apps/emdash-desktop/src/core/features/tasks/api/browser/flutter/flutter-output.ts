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

export function parseFlutterDevices(output: string): FlutterDevice[] {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  try {
    const raw = JSON.parse(output.slice(start, end + 1)) as Array<{
      id?: string;
      name?: string;
      targetPlatform?: string;
      emulator?: boolean;
      isSupported?: boolean;
    }>;
    return raw
      .filter((d) => d.id && d.name && d.isSupported !== false)
      .map((d) => ({
        id: d.id!,
        name: d.name!,
        platform: d.targetPlatform ?? '',
        emulator: d.emulator === true,
      }));
  } catch {
    return [];
  }
}

export function parseFlutterEmulators(output: string): FlutterEmulator[] {
  return output.split('\n').flatMap((line) => {
    const cols = line.split('•').map((col) => col.trim());
    if (cols.length < 4 || !cols[0] || cols[0] === 'Id') return [];
    return [{ id: cols[0], name: cols[1], platform: cols[3] }];
  });
}
