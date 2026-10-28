import { useCallback, useEffect, type ReactNode } from 'react';
import { monacoBootstrap } from '@core/features/editor/browser/monaco/monaco-bootstrap';
import { defineMonacoThemes } from '@core/features/editor/browser/monaco/monaco-themes';
import { setFileIconTheme } from '@core/features/editor/contributions/browser/file-icon-packs';
import { useAppSettingsKey } from '@core/features/settings/api/browser/use-app-settings-key';
import { applyThemeToAll } from '@core/features/terminals/api/browser/pty/pty';
import {
  ThemeProvider as CoreThemeProvider,
  GLASS_CLASS,
  GLASS_STORAGE_KEY,
  TRANSPARENT_CLASS,
  TRANSPARENT_STORAGE_KEY,
} from '@core/primitives/theme/browser';

/** Mirrors an Appearance switch onto `<html>` and into localStorage for the pre-paint script. */
function applyRootFlag(className: string, storageKey: string, enabled: boolean): void {
  document.documentElement.classList.toggle(className, enabled);
  try {
    localStorage.setItem(storageKey, enabled ? '1' : '0');
  } catch {}
}

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const { value, isLoading, update } = useAppSettingsKey('theme');
  const handleThemeApplied = useCallback(() => applyThemeToAll(), []);
  const { value: interfaceSettings } = useAppSettingsKey('interface');
  const fileIconTheme = interfaceSettings?.fileIconTheme ?? 'devicon';

  // undefined until settings load: keep what the pre-paint script restored meanwhile.
  const transparentWindow = interfaceSettings?.transparentWindow;
  const glassSurfaces = interfaceSettings?.glassSurfaces;

  useEffect(() => setFileIconTheme(fileIconTheme), [fileIconTheme]);
  useEffect(() => {
    if (glassSurfaces !== undefined) applyRootFlag(GLASS_CLASS, GLASS_STORAGE_KEY, glassSurfaces);
  }, [glassSurfaces]);
  useEffect(() => {
    if (transparentWindow === undefined) return;
    applyRootFlag(TRANSPARENT_CLASS, TRANSPARENT_STORAGE_KEY, transparentWindow);
    // The pre-paint script paints <html> opaque; drop that so the window can show through.
    document.documentElement.style.backgroundColor = transparentWindow ? 'transparent' : '';
    // Editor and terminal colors are read from CSS once; re-read them with/without alpha.
    applyThemeToAll();
    const monaco = monacoBootstrap.getMonaco();
    if (monaco) defineMonacoThemes(monaco as Parameters<typeof defineMonacoThemes>[0]);
  }, [transparentWindow]);

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
