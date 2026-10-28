import {
  THEME_MANIFEST,
  ThemeProvider as UiThemeProvider,
  type ThemeId,
} from '@emdash/ui/react/primitives';
import {
  createContext,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  THEME_POLARITY,
  themePolarityClass,
  type Theme,
  type ThemeClass,
} from '@core/primitives/app-settings/api';
import {
  THEME_CLASS_DARK,
  THEME_CLASS_LIGHT,
  THEME_CLASSES,
  THEME_POLARITY_STORAGE_KEY,
  THEME_PRESET_CLASS,
  THEME_STORAGE_KEY,
} from './theme-classes';
import { getNextTheme } from './theme-toggle-model';

export type EffectiveTheme = (typeof THEME_CLASSES)[number];

function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') return THEME_CLASS_LIGHT;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? THEME_CLASS_DARK
    : THEME_CLASS_LIGHT;
}

/**
 * Map the app's effective theme class to the @emdash/ui theme id, via the
 * manifest selectors so a rename fails loudly instead of drifting.
 */
function uiThemeId(themeClass: ThemeClass): ThemeId {
  const entry = THEME_MANIFEST.find((e) => e.selector === `.${themeClass}`);
  if (!entry) throw new Error(`No @emdash/theme entry for selector ".${themeClass}"`);
  return entry.id as ThemeId;
}

function subscribeToSystemTheme(onChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Polarity class drives the base palette; the theme class (same for Light/Dark) overrides it. */
function applyTheme(effective: EffectiveTheme, themeClass: ThemeClass) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove(...Object.keys(THEME_POLARITY), THEME_PRESET_CLASS);
  root.classList.add(effective, themeClass);
  if (themeClass !== effective) root.classList.add(THEME_PRESET_CLASS);
}

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  effectiveTheme: EffectiveTheme;
  themeClass: ThemeClass;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export interface ThemeProviderProps {
  readonly children: ReactNode;
  readonly theme: Theme;
  readonly isLoading?: boolean;
  readonly onThemeChange: (theme: Theme) => void;
  readonly onThemeApplied?: (effectiveTheme: EffectiveTheme) => void;
}

export function ThemeProvider({
  children,
  theme,
  isLoading = false,
  onThemeChange,
  onThemeApplied,
}: ThemeProviderProps) {
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme);
  const effectiveTheme: EffectiveTheme = theme ? themePolarityClass(theme) : systemTheme;
  const themeClass: ThemeClass = theme ?? systemTheme;

  useLayoutEffect(() => {
    if (isLoading) return;
    applyTheme(effectiveTheme, themeClass);
  }, [effectiveTheme, themeClass, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
      localStorage.setItem(THEME_POLARITY_STORAGE_KEY, effectiveTheme);
    } catch {
      // Local storage is only a startup paint cache; persisted settings remain authoritative.
    }
  }, [theme, effectiveTheme, isLoading]);

  const setTheme = (newTheme: Theme) => {
    onThemeChange(newTheme);
  };

  const toggleTheme = () => {
    const next = getNextTheme(theme, effectiveTheme);
    setTheme(next);
  };

  useEffect(() => {
    if (!isLoading) onThemeApplied?.(effectiveTheme);
  }, [effectiveTheme, themeClass, isLoading, onThemeApplied]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, effectiveTheme, themeClass }}>
      {/* Context-only @emdash/ui provider: the app's applyTheme above stays the
          sole DOM class writer; this makes @emdash/ui's useTheme() (needed by
          theme-aware components like markdown/shiki) work app-wide. */}
      <UiThemeProvider target="none" theme={uiThemeId(themeClass)}>
        {children}
      </UiThemeProvider>
    </ThemeContext.Provider>
  );
}
