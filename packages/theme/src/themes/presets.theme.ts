/**
 * Builds the preset themes (presets.ts) into ResolvedThemes for codegen.
 *
 * The surface ladder is pinned around the preset's real editor background so
 * each theme keeps its signature base tone instead of the default ladder's.
 */

import Color from 'colorjs.io';
import { defineTheme } from '../core/index';
import { THEME_PRESETS, type ThemePreset } from './presets';

function buildPreset(preset: ThemePreset) {
  const l = Number(new Color(preset.neutral[0]!).to('oklch').coords[0]!.toFixed(3));
  const surfaceLightness =
    preset.polarity === 'dark'
      ? {
          sunken: l - 0.03,
          base: l,
          'base-emphasis': l + 0.025,
          elevated: l + 0.045,
          'elevated-emphasis': l + 0.075,
          paper: l,
        }
      : {
          sunken: l - 0.06,
          base: l - 0.03,
          'base-emphasis': l - 0.015,
          elevated: l,
          'elevated-emphasis': l - 0.02,
          paper: l,
        };
  return defineTheme({
    id: preset.id,
    label: preset.label,
    polarity: preset.polarity,
    accent: preset.accent,
    hues: preset.hues,
    scales: { neutral: [...preset.neutral] },
    background: { lightness: l },
    surfaceLightness,
    gamut: 'p3',
    tweaks: { amber: { darkForeground: true } },
    syntax: { generate: true },
  });
}

export const presetThemes = THEME_PRESETS.map(buildPreset);
