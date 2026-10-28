import { style } from '@vanilla-extract/css';
import { GLASS, glassSurface } from '../../../styles/recipes/glass.css';
import { vars } from '@theme/core/contract/contract.css';
import { tokenVars } from '@theme/tokens.css';

/** Container for a group of Toggle buttons. */
export const toggleGroup = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.125rem',
  borderRadius: tokenVars.radiusMd,
  backgroundColor: vars.surface,
  padding: '0.125rem',
  // Borderless strip: the glass edge is an inset ring so layout doesn't shift.
  selectors: {
    [GLASS]: { ...glassSurface, boxShadow: `inset 0 0 0 1px ${glassSurface.borderColor}` },
  },
});
