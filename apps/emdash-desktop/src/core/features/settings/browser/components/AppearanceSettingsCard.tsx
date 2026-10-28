import { SettingsCard } from '@emdash/ui/react/patterns';
import { Select, SeparatedList, THEME_MANIFEST } from '@emdash/ui/react/primitives';
import { Monitor, Moon, Sun } from 'lucide-react';
import React from 'react';
import { useAppSettingsKey } from '@core/features/settings/api/browser/use-app-settings-key';
import {
  FILE_ICON_THEMES,
  themePolarityClass,
  type FileIconTheme,
  type ThemeClass,
} from '@core/primitives/app-settings/api';
import { captureTelemetry } from '@core/primitives/telemetry/browser/telemetry-client';
import { useTheme } from '@core/primitives/theme/browser';
import { SettingRow } from './SettingRow';

const SYSTEM = 'system';

const FILE_ICON_THEME_LABELS: Record<FileIconTheme, string> = {
  devicon: 'Devicon',
  material: 'Material Icon Theme',
  vscode: 'vscode-icons',
  catppuccin: 'Catppuccin',
};

const THEMES = THEME_MANIFEST.map((entry) => ({
  value: entry.selector.slice(1) as ThemeClass,
  label: entry.label,
  polarity: entry.polarity,
}));

/** Background + accent/green/red dots, painted with the theme's own --em-* vars. */
function ThemeSwatch({ value }: { value: ThemeClass | null }) {
  const Icon = value ? (themePolarityClass(value) === 'emdark' ? Moon : Sun) : Monitor;
  return (
    <span
      className={`${value ? `${themePolarityClass(value)} ${value}` : ''} flex h-5 shrink-0 items-center gap-1 rounded border border-border bg-background px-1.5`}
      aria-hidden="true"
    >
      <Icon className="size-3 text-foreground" />
      {['--em-accent-9', '--em-green-9', '--em-red-9'].map((color) => (
        <span
          key={color}
          className="size-1.5 rounded-full"
          style={{ background: value ? `var(${color})` : 'var(--foreground-passive)' }}
        />
      ))}
    </span>
  );
}

function ThemeOption({ value, label }: { value: ThemeClass | null; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <ThemeSwatch value={value} />
      <span className="truncate">{label}</span>
    </span>
  );
}

const AppearanceSettingsCard: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { value: interfaceSettings, update } = useAppSettingsKey('interface');
  const fileIconTheme = interfaceSettings?.fileIconTheme ?? 'devicon';
  const themeLabel = THEMES.find((t) => t.value === theme)?.label ?? 'System';

  const handleSetTheme = (next: string | null) => {
    const value = !next || next === SYSTEM ? null : (next as ThemeClass);
    if (theme !== value) captureTelemetry('setting_changed', { setting: 'theme' });
    setTheme(value);
  };

  return (
    <SettingsCard>
      <SeparatedList gap="1rem" direction="column">
        <SettingRow
          title="Color theme"
          description="Colors for the app, terminal, and editor."
          control={
            <Select.Root value={theme ?? SYSTEM} onValueChange={handleSetTheme}>
              <Select.Trigger className="w-56 shrink-0 gap-2">
                <Select.Value>
                  <ThemeOption value={theme} label={themeLabel} />
                </Select.Value>
              </Select.Trigger>
              <Select.Content className="max-h-96 min-w-56">
                <Select.Item value={SYSTEM}>
                  <ThemeOption value={null} label="System" />
                </Select.Item>
                {(['light', 'dark'] as const).map((polarity) => (
                  <Select.Group key={polarity}>
                    <Select.Separator />
                    <Select.Label>{polarity === 'light' ? 'Light' : 'Dark'}</Select.Label>
                    {THEMES.filter((t) => t.polarity === polarity).map((t) => (
                      <Select.Item key={t.value} value={t.value}>
                        <ThemeOption value={t.value} label={t.label} />
                      </Select.Item>
                    ))}
                  </Select.Group>
                ))}
              </Select.Content>
            </Select.Root>
          }
        />
        <SettingRow
          title="File icon theme"
          description="Icons for files and folders in the file tree, tabs, and search."
          control={
            <Select.Root
              value={fileIconTheme}
              onValueChange={(next) => update({ fileIconTheme: next as FileIconTheme })}
            >
              <Select.Trigger className="w-56 shrink-0 gap-2">
                <Select.Value>{FILE_ICON_THEME_LABELS[fileIconTheme]}</Select.Value>
              </Select.Trigger>
              <Select.Content className="min-w-56">
                {FILE_ICON_THEMES.map((value) => (
                  <Select.Item key={value} value={value}>
                    {FILE_ICON_THEME_LABELS[value]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          }
        />
      </SeparatedList>
    </SettingsCard>
  );
};

export default AppearanceSettingsCard;
