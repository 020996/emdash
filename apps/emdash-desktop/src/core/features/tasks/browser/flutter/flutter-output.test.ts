import { describe, expect, it } from 'vitest';
import {
  markerCommand,
  markerText,
  parseFlutterDevices,
  parseFlutterEmulators,
  sliceBetweenMarkers,
  stripAnsi,
} from './flutter-output';

describe('flutter output parsing', () => {
  it('cuts real output between markers, ignoring the echoed command line', () => {
    const echoed = `${markerCommand('B', 't1')}; flutter devices; ${markerCommand('E', 't1')}`;
    const text = `${echoed}\n\n${markerText('B', 't1')}\n[]\n\n${markerText('E', 't1')}\n% `;
    expect(sliceBetweenMarkers(text, 't1')?.trim()).toBe('[]');
    expect(sliceBetweenMarkers(echoed, 't1')).toBeNull();
  });

  it('parses supported devices and offline emulators', () => {
    const devices = parseFlutterDevices(
      stripAnsi(
        '\x1b[0mWaiting...\r\n[{"name":"iPhone 17","id":"ABC","isSupported":true,' +
          '"targetPlatform":"ios","emulator":true},' +
          '{"name":"Old","id":"X","isSupported":false,"targetPlatform":"ios","emulator":false}]'
      )
    );
    expect(devices).toEqual([{ id: 'ABC', name: 'iPhone 17', platform: 'ios', emulator: true }]);

    const emulators = parseFlutterEmulators(
      [
        '2 available emulators:',
        'Id                  • Name          • Manufacturer • Platform',
        'apple_ios_simulator • iOS Simulator • Apple        • ios',
        'Pixel_6_Pro         • Pixel 6 Pro   • Google       • android',
      ].join('\n')
    );
    expect(emulators.map((e) => e.id)).toEqual(['apple_ios_simulator', 'Pixel_6_Pro']);
  });
});
