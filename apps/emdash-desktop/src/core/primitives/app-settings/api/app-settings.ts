import type { TerminalShellId } from '@emdash/core/primitives/terminal-shell/api';
import { THEME_MANIFEST } from '@emdash/theme/manifest';
import type { BrowserProfile, BrowserProfileSelection } from '@core/primitives/browser/api';
import type { OpenInAppId } from '@core/primitives/open-in-apps/api/open-in-apps';

export type LocalProjectSettings = {
  defaultProjectsDirectory: string;
  defaultWorktreeDirectory: string;
};

export type ProjectSettings = {
  pushOnCreate: boolean;
  branchPrefix: string;
  appendRandomBranchSuffix: boolean;
  tmuxByDefault: boolean;
};

export type NotificationSettings = {
  enabled: boolean;
  sound: boolean;
  customSoundPath: string;
  osNotifications: boolean;
  soundFocusMode: 'always' | 'unfocused';
};

export type TaskSettings = {
  autoGenerateName: boolean;
  autoTrustWorktrees: boolean;
  createBranchAndWorktree: boolean;
  deleteBranchByDefault: boolean;
  preserveNameCapitalization: boolean;
  includeIssueContextByDefault: boolean;
};

export type FilesSettings = {
  treeExclude: string[];
  searchExclude: string[];
  watcherExclude: string[];
};

export type TerminalSettings = {
  fontFamily?: string;
  fontSize?: number;
  autoCopyOnSelection: boolean;
  macOptionIsMeta: boolean;
  defaultShell: TerminalShellId;
};

/** Theme class on `<html>` (`em<id>` from THEME_MANIFEST) → polarity. */
export const THEME_POLARITY: Readonly<Record<string, 'light' | 'dark'>> = Object.fromEntries(
  THEME_MANIFEST.map((entry) => [entry.selector.slice(1), entry.polarity])
);

export type ThemeClass = string;

export type Theme = ThemeClass | null;

export function themePolarityClass(theme: ThemeClass): 'emlight' | 'emdark' {
  return THEME_POLARITY[theme] === 'dark' ? 'emdark' : 'emlight';
}

export type InterfaceSettings = {
  showTrayIcon: boolean;
  taskHoverAction: 'delete' | 'archive';
  autoRightSidebarBehavior: boolean;
  showLeftSidebarLineChanges: boolean;
  showLeftSidebarPrStatus: boolean;
  showLeftSidebarTimestamps: boolean;
  hideContextBar: boolean;
  fileIconTheme: FileIconTheme;
};

export const FILE_ICON_THEMES = ['devicon', 'material', 'vscode', 'catppuccin'] as const;

export type FileIconTheme = (typeof FILE_ICON_THEMES)[number];

export type ProviderCustomConfig = {
  extraArgs?: string;
  env?: Record<string, string>;
};
export type ProviderCustomConfigs = Record<string, ProviderCustomConfig>;

export type ChangesViewMode = {
  unstaged: 'flat' | 'tree';
  staged: 'flat' | 'tree';
  pr: 'flat' | 'tree';
  commits: 'flat' | 'tree';
};

export type BrowserSettings = {
  defaultProfileId: BrowserProfileSelection;
  relaxCorsForLocalhost: boolean;
  profiles: BrowserProfile[];
};

export type KeyboardSettings = Record<string, string | null | undefined>;

export type OpenInSettings = {
  default: OpenInAppId;
  hidden: OpenInAppId[];
};

export type ChangesSection = keyof ChangesViewMode;
export type ChangesListViewMode = ChangesViewMode[ChangesSection];

export type HostSettings = {
  installBaseUrl: string;
};
