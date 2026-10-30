export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Converts any CSS color string (hex, hsl, color(display-p3 ...), color-mix, etc.)
 * to a hex string by painting a 1×1 canvas pixel and reading back the sRGB bytes.
 * Out-of-gamut P3 values are clamped to sRGB, which is imperceptible for UI chrome colors.
 * Returns the original string unchanged if the canvas context is unavailable.
 */
export function cssColorToHex(cssColor: string): string {
  const cached = hexCache.get(cssColor);
  if (cached) return cached;
  // One CPU-backed canvas: a GPU canvas stalls ~15ms per getImageData readback, and every
  // editor/terminal mount converts dozens of theme colors.
  pixelCtx ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext(
    '2d',
    { willReadFrequently: true }
  );
  if (!pixelCtx) return cssColor;
  pixelCtx.clearRect(0, 0, 1, 1);
  // An unparseable color keeps the previous fillStyle; reset to the fresh-canvas default.
  pixelCtx.fillStyle = '#000';
  pixelCtx.fillStyle = cssColor.trim();
  pixelCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pixelCtx.getImageData(0, 0, 1, 1).data;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const result = a < 255 ? `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}` : `#${hex(r)}${hex(g)}${hex(b)}`;
  hexCache.set(cssColor, result);
  return result;
}

let pixelCtx: CanvasRenderingContext2D | null | undefined;
const hexCache = new Map<string, string>();
