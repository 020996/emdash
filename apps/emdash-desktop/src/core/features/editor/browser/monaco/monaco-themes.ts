import type { Monaco } from '@monaco-editor/react';
import {
  THEME_POLARITY,
  themePolarityClass,
  type ThemeClass,
} from '@core/primitives/app-settings/api';
import { cssColorToHex } from '@core/primitives/styling/browser/cssVars';

type MonacoColors = Record<string, string>;
type MonacoRule = { token: string; foreground: string };

/** Generated `--em-syntax-<role>` var → Monaco token. */
const SYNTAX_TOKENS: Array<[string, string]> = [
  ['comment', 'comment'],
  ['keyword', 'keyword'],
  ['string', 'string'],
  ['number', 'number'],
  ['regexp', 'regexp'],
  ['type', 'type'],
  ['function', 'function'],
  ['variable', 'variable'],
  ['operator', 'delimiter'],
  ['tag', 'tag'],
  ['attribute', 'attribute.name'],
  ['property', 'property'],
];

/**
 * Reads all --monaco-* CSS custom properties from an element bearing the given
 * theme class, converts each value to a hex string, and returns a Monaco color
 * token map plus syntax rules. Entries where the variable is not defined for
 * that theme are omitted.
 */
function readMonacoVarsForTheme(cssClass: string): { colors: MonacoColors; rules: MonacoRule[] } {
  const el = document.createElement('div');
  el.className = cssClass;
  el.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
  document.body.appendChild(el);
  const style = getComputedStyle(el);

  const get = (v: string) => style.getPropertyValue(v).trim();

  const mapping: Array<[string, string]> = [
    ['--monaco-bg', 'editor.background'],
    ['--monaco-fg', 'editor.foreground'],
    ['--monaco-line-highlight', 'editor.lineHighlightBackground'],
    ['--monaco-line-number', 'editorLineNumber.foreground'],
    ['--monaco-gutter', 'editorGutter.background'],
    ['--monaco-inserted-text-bg', 'diffEditor.insertedTextBackground'],
    ['--monaco-inserted-line-bg', 'diffEditor.insertedLineBackground'],
    ['--monaco-inserted-text-border', 'diffEditor.insertedTextBorder'],
    ['--monaco-removed-text-bg', 'diffEditor.removedTextBackground'],
    ['--monaco-removed-line-bg', 'diffEditor.removedLineBackground'],
    ['--monaco-removed-text-border', 'diffEditor.removedTextBorder'],
    ['--monaco-unchanged-region-bg', 'diffEditor.unchangedRegionBackground'],
    ['--monaco-diff-border', 'diffEditor.border'],
    ['--monaco-diff-diagonal-fill', 'diffEditor.diagonalFill'],
    ['--monaco-selection-bg', 'editor.selectionBackground'],
    ['--monaco-selection-fg', 'editor.selectionForeground'],
    ['--monaco-inactive-selection-bg', 'editor.inactiveSelectionBackground'],
  ];

  const colors: MonacoColors = {};
  for (const [cssVar, monacoToken] of mapping) {
    const value = get(cssVar);
    if (value) {
      colors[monacoToken] = cssColorToHex(value);
    }
  }

  const rules: MonacoRule[] = [];
  for (const [role, token] of SYNTAX_TOKENS) {
    const value = get(`--em-syntax-${role}`);
    if (value) rules.push({ token, foreground: cssColorToHex(value).replace('#', '') });
  }

  el.remove();
  return { colors, rules };
}

export function defineMonacoThemes(monaco: Monaco): void {
  for (const themeClass of Object.keys(THEME_POLARITY) as ThemeClass[]) {
    const polarity = themePolarityClass(themeClass);
    const { colors, rules } = readMonacoVarsForTheme(
      themeClass === polarity ? polarity : `${polarity} ${themeClass} em-preset`
    );
    monaco.editor.defineTheme(getMonacoTheme(themeClass), {
      base: polarity === 'emdark' ? 'vs-dark' : 'vs',
      inherit: true,
      // Light/Dark keep Monaco's stock syntax colors; presets use their own.
      rules: themeClass === polarity ? [] : rules,
      colors,
    });
  }
}

export function getMonacoTheme(themeClass: ThemeClass): string {
  return `custom-${themeClass}`;
}
