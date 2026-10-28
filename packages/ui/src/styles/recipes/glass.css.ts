/**
 * glass.css.ts — frosted-glass treatment toggled by `.em-glass` on <html>
 * (Appearance → Glass surfaces). Ported from clean_my_mobile's glassSurface:
 * tint gradient 7.5% → 4% → 2.5%, 1px edge at 13%, top highlight 20% → 0 at 42% (toned to 6%: on
 * desktop panels 20% read as a lighter, mismatched card).
 *
 * The tint uses the theme foreground so light themes get a dark-tinted glass and
 * dark themes a white one; theme hues are never replaced. Recipes opt in with
 * `selectors: { [GLASS]: glassSurface }`. Blur is reserved for floating popups:
 * blurring every card/row is what makes scrolling jank.
 */

import type { StyleRule } from '@vanilla-extract/css';
// Relative import: the dts emitter rewrites aliased imports to a dangling relative path.
import { vars } from '../../theme/core/contract/contract.css';

/**
 * Selector key for recipes: applies only while the glass switch is on. `:where()` keeps it at the
 * element's own specificity, so status borders and focus rings declared later still win.
 */
export const GLASS = ':where(.em-glass) &';

const tint = (percent: number) =>
  `color-mix(in oklab, ${vars.foreground} ${percent}%, transparent)`;

export const glassSurface: StyleRule = {
  backgroundImage: [
    'linear-gradient(to bottom, rgb(255 255 255 / 0.06), rgb(255 255 255 / 0) 42%)',
    `linear-gradient(to bottom, ${tint(7.5)}, ${tint(4)}, ${tint(2.5)})`,
  ].join(', '),
  borderColor: tint(13),
};

/**
 * See-through window: floating layers sit over busy content, so they get a near-solid copy of the
 * theme's elevated surface (`--glass-src-*` is captured on html in the renderer) and blur what is
 * behind. Applied with `globalStyle(\`${TRANSPARENT} ${popupClass}\`, transparentPopup)`.
 */
export const TRANSPARENT = ':where(.em-transparent)';

export const transparentPopup = {
  backgroundColor: 'color-mix(in oklab, var(--glass-src-surface-elevated) 88%, transparent)',
  backdropFilter: 'blur(24px) saturate(1.4)',
};
