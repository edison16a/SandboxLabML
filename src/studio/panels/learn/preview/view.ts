/** World bounds in meters. Racing calls the second axis y, Hide and Seek calls it z. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Maps world meters to canvas pixels. Racing's y runs up the screen, like
 * a map, so it is flipped. Hide and Seek's z already runs down the screen
 * when the room is seen from above.
 */
export interface View {
  scale: number;
  ox: number;
  oy: number;
  flip: boolean;
}

/** Fits `b` into a w x h canvas with `margin` meters to spare on every side, centered. */
export function fitView(b: Bounds, w: number, h: number, margin: number, flip: boolean): View {
  const scale = Math.max(1e-6, Math.min(w / (b.maxX - b.minX + 2 * margin), h / (b.maxY - b.minY + 2 * margin)));
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { scale, ox: w / 2 - cx * scale, oy: flip ? h / 2 + cy * scale : h / 2 - cy * scale, flip };
}

export const px = (v: View, x: number) => v.ox + x * v.scale;
export const py = (v: View, y: number) => (v.flip ? v.oy - y * v.scale : v.oy + y * v.scale);

/**
 * Sizes the canvas's backing store to its box at the device pixel ratio,
 * only when that changed (resizing clears it), and returns a context that
 * draws in CSS pixels. Null while the canvas has no size, as when it is
 * off in a hidden panel.
 */
export function prepareCanvas(canvas: HTMLCanvasElement): { g: CanvasRenderingContext2D; w: number; h: number } | null {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const g = canvas.getContext('2d');
  if (!g || w === 0 || h === 0) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  g.setTransform(bw / w, 0, 0, bh / h, 0, 0);
  return { g, w, h };
}
