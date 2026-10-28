import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { APP_NAME_LOWER } from '@core/primitives/app-identity/api/app-identity';

export const APP_SCHEME = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_NAME_LOWER}`;

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        // Let Blink persist V8 code cache for app:// scripts, so repeat
        // launches skip recompiling the renderer bundle.
        codeCache: true,
      },
    },
  ]);
}

/** Resolves a local workspace item to its native path (null when it may not be served). */
export type WorkspaceFileResolver = (args: {
  workspaceId: string;
  relativePath: string;
}) => Promise<string | null>;

export function setupAppProtocol(
  rendererRoot: string,
  resolveWorkspaceFile?: WorkspaceFileResolver
): void {
  const root = normalize(rendererRoot);

  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    if (resolveWorkspaceFile && pathname.startsWith(WORKSPACE_FILE_PREFIX))
      return serveWorkspaceFile(pathname, resolveWorkspaceFile);
    const relPath = decodeURIComponent(pathname).replace(/^\/+/, '');
    const resolved = normalize(join(root, relPath || 'index.html'));

    if (!resolved.startsWith(root + sep) && resolved !== root) {
      return new Response(null, { status: 403 });
    }

    try {
      return await net.fetch(pathToFileURL(resolved).href);
    } catch {
      return net.fetch(pathToFileURL(join(root, 'index.html')).href);
    }
  });
}

/** `/__workspace-file/<workspaceId>/<relative path>`: the file-tree drag-out (`DownloadURL`) source. */
const WORKSPACE_FILE_PREFIX = '/__workspace-file/';

async function serveWorkspaceFile(
  pathname: string,
  resolveWorkspaceFile: WorkspaceFileResolver
): Promise<Response> {
  const [workspaceId = '', ...segments] = pathname
    .slice(WORKSPACE_FILE_PREFIX.length)
    .split('/')
    .map(decodeURIComponent);
  try {
    const path = await resolveWorkspaceFile({ workspaceId, relativePath: segments.join('/') });
    if (!path) return new Response(null, { status: 404 });
    return await net.fetch(pathToFileURL(path).href);
  } catch {
    return new Response(null, { status: 404 });
  }
}
