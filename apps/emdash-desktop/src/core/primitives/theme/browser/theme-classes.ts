/**
 * Canonical theme class names shared by the app's theme system and
 * @emdash/theme's generated selectors.
 *
 * Both palettes (the app's unprefixed vars in index.css and the generated
 * --em-* vars from @emdash/theme) key off the SAME class on <html>, so a
 * single classList write themes both systems atomically. The values here must
 * stay equal to the THEME_MANIFEST selectors in
 * packages/theme/src/themes/registry.ts — theme-classes.test.ts enforces it.
 *
 * The pre-paint script in src/renderer/index.html cannot import this module
 * and hardcodes the same literals; the test covers that file too.
 */
export const THEME_CLASS_LIGHT = 'emlight';
export const THEME_CLASS_DARK = 'emdark';
export const THEME_CLASSES = [THEME_CLASS_LIGHT, THEME_CLASS_DARK] as const;

/** localStorage key the pre-paint script reads to avoid a theme flash. */
export const THEME_STORAGE_KEY = 'emdash-theme';

/** localStorage key holding the stored theme's polarity class, read by the pre-paint script. */
export const THEME_POLARITY_STORAGE_KEY = 'emdash-theme-polarity';

/** Marks a preset theme on `<html>`; index.css remaps the base palette onto its --em-* vars. */
export const THEME_PRESET_CLASS = 'em-preset';

/** See-through window (macOS vibrancy); index.css gives the theme backgrounds alpha. */
export const TRANSPARENT_CLASS = 'em-transparent';

/** Frosted glass on cards, buttons, tabs and menus (packages/ui recipes). */
export const GLASS_CLASS = 'em-glass';

/** localStorage flags ('1' = on) the pre-paint script reads for the two classes above. */
export const TRANSPARENT_STORAGE_KEY = 'emdash-transparent';
export const GLASS_STORAGE_KEY = 'emdash-glass';
