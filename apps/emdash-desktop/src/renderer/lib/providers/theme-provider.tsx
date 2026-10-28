import { useCallback, useEffect, type ReactNode } from 'react';
import { setFileIconTheme } from '@core/features/editor/contributions/browser/file-icon-packs';
import { useAppSettingsKey } from '@core/features/settings/api/browser/use-app-settings-key';
import { applyThemeToAll } from '@core/features/terminals/api/browser/pty/pty';
import { ThemeProvider as CoreThemeProvider } from '@core/primitives/theme/browser';

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const { value, isLoading, update } = useAppSettingsKey('theme');
  const handleThemeApplied = useCallback(() => applyThemeToAll(), []);
  const { value: interfaceSettings } = useAppSettingsKey('interface');
  const fileIconTheme = interfaceSettings?.fileIconTheme ?? 'devicon';

  useEffect(() => setFileIconTheme(fileIconTheme), [fileIconTheme]);

  return (
    <CoreThemeProvider
      theme={value ?? null}
      isLoading={isLoading}
      onThemeChange={update}
      onThemeApplied={handleThemeApplied}
    >
      {children}
    </CoreThemeProvider>
  );
}
