import { style } from '@vanilla-extract/css';

export const card = style({
  display: 'flex',
  flexDirection: 'column',
});

export const body = style({
  display: 'flex',
  flexDirection: 'column',
});

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
});

// Flush with the page header so every heading shares one left edge.
export const sectionTitle = style({
  paddingInline: 0,
});
