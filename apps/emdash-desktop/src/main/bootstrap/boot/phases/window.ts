import { join } from 'node:path';
import { app } from 'electron';
import { appService } from '@main/core/app/service';
import { installDesktopWire } from '@main/gateway/desktop-wire';
import { setupApplicationMenu } from '@main/host/menu';
import { setupAppProtocol } from '@main/host/protocol';
import { createMainWindow } from '@main/host/window';
import { registerQuitHandler } from '../../shutdown';
import type { BootSignals } from '../types';

export function bootWindow(signals: BootSignals): void {
  // Workspace files for Finder drag-out: same resolution as Show in Finder (local, inside root).
  setupAppProtocol(join(app.getAppPath(), 'out', 'renderer'), async (args) => {
    const resolved = await appService.resolveLocalWorkspaceFile(args);
    return resolved.success ? resolved.data : null;
  });
  setupApplicationMenu();
  // The renderer requests its wire port as soon as it boots, which under the
  // window-first boot happens long before controllers exist. The port handler
  // must be live before loadURL; traffic queues until controllers register.
  installDesktopWire();
  createMainWindow();
  registerQuitHandler();
  signals.windowPhaseReady = true;
}
