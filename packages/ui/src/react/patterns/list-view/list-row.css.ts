import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import type { RecipeVariants } from '@vanilla-extract/recipes';
import { glassSurface } from '../../../styles/recipes/glass.css';
import { vars } from '@theme/core/contract/contract.css';
import { tokenVars } from '@theme/tokens.css';

export const row = recipe({
  base: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    borderBottom: `1px solid ${vars.border}`,
    transition: 'background-color 100ms',
    selectors: {
      // Glass surfaces: each row is its own glass card. The gap is a transparent border
      // (background clipped inside it) so virtualized row heights still measure the full box.
      // `.em-glass &` outranks the divider/isLast variants; hover still wins on order.
      '.em-glass &': {
        ...glassSurface,
        border: '3px solid transparent',
        borderRadius: tokenVars.radiusLg,
        backgroundClip: 'padding-box',
        backgroundColor: vars.surfaceBase,
        boxShadow: `inset 0 0 0 1px ${glassSurface.borderColor}`,
      },
    },
  },
  variants: {
    interactive: {
      true: {
        cursor: 'pointer',
        selectors: {
          '&:hover': { backgroundColor: vars.surfaceHover },
        },
      },
    },
    selected: {
      true: {
        backgroundColor: vars.surfaceSelected,
        selectors: {
          '&:hover': { backgroundColor: vars.surfaceSelected },
        },
      },
    },
    isLast: {
      true: { borderBottom: 'none' },
    },
    divider: {
      default: {},
      subtle: { borderBottomColor: vars.borderSubtle },
    },
  },
  defaultVariants: {
    interactive: false,
    selected: false,
    isLast: false,
    divider: 'default',
  },
});

export type RowVariants = NonNullable<RecipeVariants<typeof row>>;

/** Inner content padding for a standard Row. */
export const rowInner = style({
  display: 'flex',
  position: 'relative',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '0.75rem',
});

/**
 * SectionHeader — label + optional count, used by the Agents view
 * "Recommended (4)" / "All agents (12)" pattern.
 */
export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  paddingLeft: '1rem',
  paddingRight: '1rem',
  paddingTop: '0.5rem',
  paddingBottom: '0.25rem',
});

export const sectionHeaderLabel = style({
  fontSize: tokenVars.textSm,
  fontWeight: 400,
  color: vars.foreground,
});

export const sectionHeaderCount = style({
  fontSize: tokenVars.textXs,
  color: vars.foregroundMuted,
});
