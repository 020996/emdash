# Glass UI — design

## Intent

The user wants Emdash to feel like a macOS Finder "Get Info" window: the whole window see-through,
with the desktop blurred behind it. They also want the glass look from their own Android app
`~/Documents/MyCode/money/clean_my_mobile` (`core/ui/glass/GlassSurface.kt`, `theme/Color.kt`) on
cards, buttons and tabs. These are two independent switches that look best together.

## Decided by the user

- **Two switches** in Settings → Interface → Appearance card (`AppearanceSettingsCard.tsx`), each on/off
  independently:
  1. **Transparent window** — native window background becomes see-through and the OS blurs the
     desktop behind it (macOS vibrancy).
  2. **Glass surfaces** — cards, buttons, tabs, menus/popovers get the clean_my_mobile glass treatment.
- **Theme colors do not change.** Every color theme (base + 29 presets) keeps its own hues; glass only
  makes theme surfaces partially translucent and adds the glass edge/highlight. Text colors stay the
  theme's own.
- **Both switches compose**: transparent window + glass surfaces = glass panels floating over the
  blurred desktop. Either alone must still look right.
- **Editor (Monaco) and terminal (xterm)** follow the transparent window too, but with a heavy theme
  scrim (~85% of the theme background) so code stays readable — the clean_my_mobile "scrim" idea.

## The glass recipe (from clean_my_mobile, adapted to theme colors)

clean_my_mobile values, dark: gradient white 7.5% → 4% → 2.5% (top→bottom), 1px border white 13%,
top highlight white 20% fading to 0 at 42% height, blur 24dp, scrim void @44%.

Adapted for Emdash (claude's call): use the theme's `--foreground` instead of hard white so light
themes get a dark-tinted glass and dark themes a white-tinted glass; keep the same percentages.
`backdrop-filter: blur(24px) saturate(1.4)` only on floating layers (menus, popovers, dialogs,
tooltips) — not on every card/row (clean_my_mobile rule: never blur inside list items; perf).

## Transparent window behaviour

- macOS only for v1. Windows (acrylic `backgroundMaterial`) and Linux: the switch is hidden.
- Main process: `BrowserWindow` toggled at runtime with `setVibrancy('under-window')` +
  `setBackgroundColor('#00000000')`, and `setVibrancy(null)` + theme background color when off. Also
  applied once services boot (`services.ts`, next to `applyNativeTheme`). The window is created
  before the DB is readable, so the first fraction of a second shows the opaque boot color and the blur
  switches on right after — accepted (claude's call; avoids a new pre-DB persistence path or slowing
  the window-first boot). Keep the default
  `visualEffectState` (`followWindow`): like Finder, the blur goes flat when the window is inactive
  (claude's call).
- Renderer: html gets class `em-transparent`; the canvas background tokens (`--background`,
  `--background-1..3`, titlebar/sidebar surfaces, `--em-surface*` used for panels) are re-expressed as
  `color-mix(in oklab, var(--em-<token>) N%, transparent)` from the theme's own `--em-*` value.
  Suggested N: canvas ~55%, sidebars/titlebar ~45%, raised surfaces ~70%, editor/terminal 85%.
  Builder tunes by eye in both a light and a dark theme.
- Splash/pre-paint: `index.html` pre-paint script adds `em-transparent` from localStorage (same
  pattern as `emdash-theme`) so the first frame matches.
- macOS native appearance: while the transparent window is on, `nativeTheme.themeSource` on macOS
  follows the app theme's polarity (`THEME_POLARITY`), so the OS blur tint matches the theme (a dark
  theme on a light-mode Mac gets a dark frost). When transparency is off, macOS keeps today's behaviour
  (follow system). Native menus/dialogs follow along while it's on — accepted (claude's call).
- Chat transcript (`--chat-bg`) gets the same 85% scrim as editor/terminal: it is a main reading
  surface (claude's call). Diff/PR/markdown views use whatever token they already share with those.
- Monaco: `editor.background` for the active theme gets alpha (85%) when transparent; xterm needs
  `allowTransparency: true` and `--xterm-bg` with alpha.

## Glass surfaces behaviour

- html class `em-glass`. CSS under `.em-glass` restyles: `card()` recipe surfaces, `Button`
  secondary/ghost variants, tab bars + tab items, ToggleGroup, Select/DropdownMenu/Popover/Dialog
  surfaces. Implemented as overrides in the app (`src/renderer/index.css` or a new `glass.css`
  imported there), not by rewriting each vanilla-extract recipe — keeps the change revertible and
  theme-agnostic. Specificity: vanilla-extract classes beat plain classes, so overrides need
  `.em-glass .x` specificity or `[data-slot]` hooks; builder verifies in devtools.
- Accent stays the theme accent; primary buttons keep their solid accent (clean_my_mobile uses accent
  glass `accentTint` 30% + `accentBorder` — optional, builder's call if it reads well).

## Settings plumbing

- `InterfaceSettings` gains `transparentWindow: boolean` and `glassSurfaces: boolean`, defaults
  `false`, zod `.catch(false)` in `src/core/features/workbench/contributions/settings.ts`.
- Renderer applies `em-glass` / `em-transparent` html classes from those settings (same place
  `fileIconTheme` is applied: `src/renderer/lib/providers/theme-provider.tsx`), and mirrors to
  localStorage for pre-paint.
- Main: `SettingsRuntimePort` gains `setTransparentWindow(enabled)`; `reconcileSettingsRuntimeState`
  calls it on `interface` updates; boot (`services.ts` near `applyNativeTheme`) applies the stored
  value; `window.ts` owns the BrowserWindow calls.

## Goals / non-goals / anti-goals

- Goal: looks like the Finder Info window when both are on; zero visual change when both off.
- Non-goal: per-theme glass tuning, Windows/Linux transparency, user-adjustable opacity slider.
- Anti-goal: unreadable text/code; theme colors drifting; scroll jank from blur on list rows.

## Tests

- Settings schema defaults/catch for the two new fields.
- `reconcileSettingsRuntimeState` calls `setTransparentWindow` on interface update.
- Pre-paint script test (existing `theme-classes.test.ts` pattern) contains the transparent key.
- Visual check by running the app (light + dark theme, each switch alone and both).
