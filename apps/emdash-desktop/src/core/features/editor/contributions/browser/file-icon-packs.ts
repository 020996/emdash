import { useSyncExternalStore } from 'react';
import type { FileIconTheme } from '@core/primitives/app-settings/api';
import { log } from '@core/primitives/logging/browser/logger';

type IconifySet = {
  icons: Record<
    string,
    { body: string; width?: number; height?: number; left?: number; top?: number }
  >;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
};

/** Returns an SVG string for a file or folder name, or null to fall back to devicon. */
export type IconResolver = (name: string, kind: IconKind) => string | null;

type IconKind = 'file' | 'folder' | 'folder-open';

function toSvg(set: IconifySet, iconName: string): string | null {
  const name = iconName.replaceAll('_', '-');
  const icon = set.icons[name] ?? set.icons[set.aliases?.[name]?.parent ?? ''];
  if (!icon) return null;
  const width = icon.width ?? set.width ?? 16;
  const height = icon.height ?? set.height ?? 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="${icon.left ?? 0} ${icon.top ?? 0} ${width} ${height}">${icon.body}</svg>`;
}

/** Material Icon Theme's manifest lookup: exact name, then longest extension suffix. */
async function materialMapping(): Promise<(name: string, kind: IconKind) => string> {
  const manifest = (await import('material-icon-theme/dist/material-icons.json')).default as {
    fileNames: Record<string, string>;
    fileExtensions: Record<string, string>;
    folderNames: Record<string, string>;
    folderNamesExpanded: Record<string, string>;
  };
  return (name, kind) => {
    const lower = name.toLowerCase();
    if (kind === 'folder') return manifest.folderNames[lower] ?? 'folder';
    if (kind === 'folder-open') return manifest.folderNamesExpanded[lower] ?? 'folder-open';
    if (manifest.fileNames[lower]) return manifest.fileNames[lower];
    const parts = lower.split('.');
    for (let i = 1; i < parts.length; i++) {
      const icon = manifest.fileExtensions[parts.slice(i).join('.')];
      if (icon) return icon;
    }
    return 'file';
  };
}

async function loadResolver(theme: Exclude<FileIconTheme, 'devicon'>): Promise<IconResolver> {
  if (theme === 'vscode') {
    const [{ default: set }, mapping] = await Promise.all([
      import('@iconify-json/vscode-icons/icons.json'),
      import('vscode-icons-js'),
    ]);
    const iconName = (svgFile: string) => svgFile.replace(/\.svg$/, '').replaceAll('_', '-');
    return (name, kind) =>
      toSvg(
        set as IconifySet,
        iconName(
          kind === 'folder'
            ? mapping.getIconForFolder(name)
            : kind === 'folder-open'
              ? mapping.getIconForOpenFolder(name)
              : (mapping.getIconForFile(name) ?? mapping.DEFAULT_FILE)
        )
      );
  }
  const [{ default: set }, mapping] = await Promise.all([
    theme === 'material'
      ? import('@iconify-json/material-icon-theme/icons.json')
      : import('@iconify-json/catppuccin/icons.json'),
    materialMapping(),
  ]);
  // Generic icons per set; iconify renamed Material's defaults.
  const generic: Record<IconKind, string> =
    theme === 'material'
      ? { file: 'document', folder: 'folder-base', 'folder-open': 'folder-base-open' }
      : { file: 'file', folder: 'folder', 'folder-open': 'folder-open' };
  // ponytail: Catppuccin reuses Material's mapping; names it lacks fall back to its generic icons.
  return (name, kind) =>
    toSvg(set as IconifySet, mapping(name, kind)) ?? toSvg(set as IconifySet, generic[kind]);
}

let resolver: IconResolver | null = null;
let requested: FileIconTheme = 'devicon';
const listeners = new Set<() => void>();

export function setFileIconTheme(theme: FileIconTheme): void {
  if (theme === requested) return;
  requested = theme;
  const publish = (next: IconResolver | null) => {
    if (requested !== theme) return;
    resolver = next;
    listeners.forEach((listener) => listener());
  };
  if (theme === 'devicon') return publish(null);
  loadResolver(theme).then(publish, (error) => {
    log.warn('Loading file icon theme failed', { theme, error });
    publish(null);
  });
}

export function useIconResolver(): IconResolver | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => resolver
  );
}
