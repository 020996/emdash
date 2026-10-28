# Color themes + file icon themes

## Intent

The user moves between VS Code and Emdash all day and wants Emdash to be restyled the same way:
pick a color theme (background, text, accents, terminal, code colors) and, separately, a file icon
theme. Today Emdash only offers Light / Dark / System and one fixed icon set (devicon).

## Goals

- **10 color themes**, picked in Settings: Light, Dark, Solarized Light, Solarized Dark (these four
  already exist in `packages/theme`), plus One Dark Pro, Dracula, Nord, GitHub Dark, Monokai,
  Tokyo Night. "System" (follow macOS light/dark) stays.
- A theme recolors the whole app: UI surfaces and text, the terminal (xterm reads theme CSS vars),
  and code in the editor (Monaco).
- **4 file icon themes**, picked in Settings: Devicon (current, default), Material Icon Theme,
  vscode-icons, Catppuccin. Icons cover files *and* folders wherever `FileIcon` is used today
  (file tree, tabs, search results, command palette) plus folder rows in the file tree.
- **Color theme and icon theme are independent** (user's explicit ask): any icon theme with any
  color theme.

## Non-goals

- User-editable theme files / custom colors (user chose a preset list).
- More than 4 icon sets (agreed: each set is large and needs its own file-to-icon rules).
- Theming the marketing site, Storybook-only themes, or per-project themes.

## Anti-goals

- A theme that leaves parts of the app in the old Dark/Light colors (mixed palettes).
- A flash of the wrong theme on startup.
- The default install getting heavier for users who never change icon theme: non-default icon sets
  are loaded on demand, not bundled into the startup path.

## Constraints (from the codebase)

- A theme is a class on `<html>` that drives **two** palettes at once: the app's unprefixed vars in
  `src/renderer/index.css` and the generated `--em-*` vars from `packages/theme`
  (`theme-classes.ts` explains this; `theme-classes.test.ts` enforces class/selector parity, and
  the pre-paint script in `src/renderer/index.html` hardcodes the class list).
- Themes are declared with `defineTheme()` from seed colors and generated at build time
  (`packages/theme`, codegen to the theme CSS).
- The setting is stored as `Theme` in app settings (`@core/primitives/app-settings/api`), today
  `'emlight' | 'emdark' | null` (null = System). The toggle command flips light/dark.
- Monaco has only `custom-dark` / `custom-light` (`editor/browser/monaco/monaco-themes.ts`).
- New dependencies must be MIT-compatible and keep `pnpm-lock.yaml` in sync. Candidates checked:
  `material-icon-theme` (MIT, file/folder mapping manifest), `vscode-icons-js` (MIT, mapping),
  `@iconify-json/material-icon-theme`, `@iconify-json/vscode-icons`, `@iconify-json/catppuccin`
  (MIT, SVG collections). No npm package ships Catppuccin's mapping.

## Decisions (builder's call unless marked)

- Theme list and the 6 new names: user agreed to the proposed list.
- Independence of icon and color theme: user.
- Catppuccin icons reuse Material Icon Theme's mapping (icon names largely line up); an icon name
  missing from the Catppuccin set falls back to Catppuccin's generic file/folder icon.
- The light/dark toggle command keeps toggling between the *polarity* defaults (Light ↔ Dark).
- Settings UI: two selects on the Interface page, "Color theme" and "File icon theme".

## Left to the builder

Seed colors for each new theme, Monaco token colors per theme, how the legacy `index.css` palette
is produced for new themes (generate vs hand-map), lazy-loading mechanics for icon sets.

## Defaults picked after builder check (user said "làm luôn")

- Chat transcript (`packages/chat-ui`) is out of scope for v1: its code blocks follow the Shiki theme
  that `@emdash/ui` resolves from the active theme id; its own devicon resolver is unchanged.
- "System" keeps meaning macOS Light ↔ Dark defaults only.
- Switching to a non-default icon set may show devicon icons for a moment while the set loads.
