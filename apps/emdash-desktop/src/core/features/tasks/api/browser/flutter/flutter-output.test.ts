import { describe, expect, it } from 'vitest';
import {
  markerCommand,
  markerText,
  openRunToken,
  parseDaemonLine,
  sliceBetweenMarkers,
} from './flutter-output';

describe('flutter output parsing', () => {
  it('cuts real output between markers, ignoring the echoed command line', () => {
    const echoed = `${markerCommand('B', 't1')}; flutter devices; ${markerCommand('E', 't1')}`;
    const text = `${echoed}\n\n${markerText('B', 't1')}\n[]\n\n${markerText('E', 't1')}\n% `;
    expect(sliceBetweenMarkers(text, 't1')?.trim()).toBe('[]');
    expect(sliceBetweenMarkers(echoed, 't1')).toBeNull();
  });

  it('maps flutter daemon lines to device list changes', () => {
    expect(parseDaemonLine('[{"event":"daemon.connected","params":{"version":"0.6.1"}}]')).toEqual({
      kind: 'connected',
    });
    expect(
      parseDaemonLine(
        '[{"event":"device.added","params":{"id":"ABC","name":"iPhone 17","platform":"ios",' +
          '"emulator":true,"connectionInterface":"attached"}}]'
      )
    ).toEqual({
      kind: 'added',
      device: { id: 'ABC', name: 'iPhone 17', platform: 'ios', emulator: true },
    });
    expect(
      parseDaemonLine(
        '[{"event":"device.added","params":{"id":"W","name":"Phone","platform":"ios",' +
          '"emulator":false,"connectionInterface":"wireless"}}]'
      )
    ).toBeNull();
    expect(parseDaemonLine('[{"event":"device.removed","params":{"id":"ABC"}}]')).toEqual({
      kind: 'removed',
      id: 'ABC',
    });
    expect(
      parseDaemonLine(
        '[{"id":2,"result":[{"id":"Pixel_6_Pro","name":"Pixel 6 Pro","platformType":"android"}]}]'
      )
    ).toEqual({
      kind: 'emulators',
      emulators: [{ id: 'Pixel_6_Pro', name: 'Pixel 6 Pro', platform: 'android' }],
    });
    expect(parseDaemonLine('[{"id":1,"method":"device.enable"}]')).toBeNull();
    expect(parseDaemonLine('% flutter daemon')).toBeNull();
  });

  it('finds the run still in progress in a replayed log', () => {
    const start = (t: string) => `\n${markerText('S', t)}\nLaunching...`;
    expect(openRunToken(`${start('a')}\n${markerText('X', 'a')}`)).toBeNull();
    expect(openRunToken(`${start('a')}\n^C\n% `)).toBeNull();
    expect(openRunToken(`${start('a')}\n${markerText('X', 'a')}${start('b')}`)).toBe('b');
    expect(openRunToken('% ')).toBeNull();
  });
});
