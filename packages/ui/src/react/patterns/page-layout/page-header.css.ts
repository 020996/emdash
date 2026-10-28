import { style } from '@vanilla-extract/css';
import { vars } from '@theme/core/contract/contract.css';

type CSSExtra = { [key: string]: string };

// ── Root ──────────────────────────────────────────────────────────────────────

export const header = style({
  display: 'flex',
  flexDirection: 'column',
});

export const headerSticky = style({
  position: 'sticky',
  top: 0,
  zIndex: 10,
  backgroundColor: vars.background,
  paddingTop: '2.5rem',
  selectors: {
    // See-through window clears the page background, so nothing could hide what scrolls under a
    // sticky header (and a backdrop blur reads as a separate tinted block): let it scroll away.
    ':where(.em-transparent) &': { position: 'static' },
  },
});

// ── Title block ───────────────────────────────────────────────────────────────

export const titleBlock = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  ...({ WebkitAppRegion: 'drag' } as CSSExtra),
});

// ── Actions slot ──────────────────────────────────────────────────────────────

export const actions = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  marginTop: '2rem',
  ...({ WebkitAppRegion: 'no-drag' } as CSSExtra),
});

// ── Separator ─────────────────────────────────────────────────────────────────

export const separator = style({
  height: '1px',
  backgroundColor: vars.border,
  flexShrink: 0,
  marginTop: '1.75rem',
});
