# Color + File Icon Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 10 selectable color themes + 4 independently selectable file icon themes.

**Architecture:** The `theme` setting stores a theme class (`emlight`, `emdracula`, …). `<html>`
gets the polarity class (`emlight`/`emdark`, which keeps every existing `effectiveTheme` consumer
working) plus the theme class. Non-base theme classes remap the legacy `index.css` vars onto the
generated `--em-*` vars. A separate `fileIconTheme` setting picks an icon resolver; non-default
packs are `import()`ed on first use.

**Tech Stack:** `@emdash/theme` codegen, MobX-free React context, Monaco, xterm,
`@iconify-json/*`, `material-icon-theme`, `vscode-icons-js`.

**Spec:** `docs/superpowers/specs/2026-10-27-color-and-icon-themes-design.md`

## Global Constraints

- Theme list: Light, Dark, Solarized Light, Solarized Dark, One Dark Pro, Dracula, Nord, GitHub Dark, Monokai, Tokyo Night; plus System.
- Icon list: Devicon (default), Material Icon Theme, vscode-icons, Catppuccin.
- Unknown stored values fall back to default (`null` theme, `devicon` icons).
- No flash: pre-paint script applies both classes.

## Review Focus

- Toggle command while a dark non-base theme is active ⇒ goes to Light (no leftover theme class).
- Switching Dracula ⇒ Nord (same polarity) must refresh terminal and Monaco colors.
- Main process (`color-env.ts`, `window.ts`) must resolve polarity of new theme classes.
- Icon pack load failure ⇒ keep devicon, no crash.
- Folder names / dotfiles (`.gitignore`, `package.json`) resolve in each pack.

---

### Task 1: Theme catalog + codegen
- Add 6 `defineTheme` files in `packages/theme/src/themes/`, register in `registry.ts` and `core/codegen/run.ts`, run `pnpm run build:theme`.
- `app-settings.ts`: `THEME_POLARITY: Record<ThemeClass, 'light'|'dark'>`, `Theme = ThemeClass | null`, `themePolarityClass(theme)`.
- `theme-classes.test.ts`: keys of `THEME_POLARITY` equal manifest selectors and polarities; `index.html` dark list matches.

### Task 2: Apply theme
- `theme-provider.tsx`: apply polarity + theme class; context exposes `themeClass`; `onThemeApplied` fires on `themeClass`.
- `index.html` pre-paint, `settings.ts` zod schema, `theme-toggle-model.ts`, `color-env.ts`, `window.ts`.
- `index.css`: one `:is(<non-base classes>)` block mapping legacy scale/semantic vars to `--em-*`.

### Task 3: Monaco
- `defineMonacoThemes` defines `custom-<class>` per theme class (probe with both classes), token rules from `--em-syntax-*` for non-base themes; callers pass `themeClass`.

### Task 4: File icon themes
- `fileIconTheme` setting (`devicon|material|vscode|catppuccin`).
- `file-icon-packs.ts`: lazy loaders returning `(name, kind) => svg | null`.
- `FileIcon` + new `FolderIcon` use the active pack; folder rows in file tree use `FolderIcon`.

### Task 5: Settings UI + gates
- Interface page: Color theme select (replaces ThemeCard grid), File icon theme select.
- typecheck, lint, format, focused tests, dev run.
