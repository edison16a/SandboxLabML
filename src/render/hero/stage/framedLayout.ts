import { coverFrame, type Cover, type PosterFrame } from './posterFrame';
import { splitLayout, type Pane, type Rect, type SplitLayout } from './splitLayout';

/**
 * The least share of the poster frame a window may keep. Across the split
 * the subjects sit near the frame's edges (the SUV starts about 7% in from
 * the left), so a crop there must be shallow; along it they sit near the
 * middle and a deep crop is fine.
 */
const MIN_SHARE_ACROSS = 0.88;
const MIN_SHARE_ALONG = 0.6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** True when covering the hero with `frame` keeps both subjects well on screen. */
export function fitsFrame(frame: PosterFrame, width: number, height: number): boolean {
  const ratio = width / height / (frame.width / frame.height);
  // Side by side, a hero narrower than the frame loses its sides, where the subjects are. Stacked, a wider one loses top and bottom.
  const across = frame.height > frame.width ? ratio > 1 : ratio < 1;
  return Math.min(ratio, 1 / ratio) >= (across ? MIN_SHARE_ACROSS : MIN_SHARE_ALONG);
}

/** A pane of the poster frame placed on screen: its canvas is the part the hero shows, and its view that part in the frame's px. */
function framed(p: Pane, cover: Cover, width: number, height: number): Pane {
  const s = cover.scale;
  const sx = cover.x + p.rect.x * s;
  const sy = cover.y + p.rect.y * s;
  const x0 = Math.round(clamp(sx, 0, width));
  const y0 = Math.round(clamp(sy, 0, height));
  const rect: Rect = { x: x0, y: y0, w: Math.max(1, Math.round(clamp(sx + p.rect.w * s, 0, width)) - x0), h: Math.max(1, Math.round(clamp(sy + p.rect.h * s, 0, height)) - y0) };
  return { ...p, rect, view: { x: (x0 - sx) / s, y: (y0 - sy) / s, w: rect.w / s, h: rect.h / s } };
}

/**
 * The hero's split, composed like its poster: each scene frames its shot
 * for the poster frame and shows the part of it the window keeps, cropped
 * and scaled exactly as the poster image is, so the live scene fades in
 * over its own still without a jump. When the window's shape is too far
 * from the frame's for that (or no frame applies), the hero frames itself
 * around the measured text panel instead.
 */
export function heroLayout(width: number, height: number, frame: PosterFrame | null, panel: Rect | null): SplitLayout {
  if (!frame || !fitsFrame(frame, width, height)) return splitLayout(width, height, panel);
  const base = splitLayout(frame.width, frame.height, frame.panel);
  const cover = coverFrame(frame, width, height);
  return { stacked: base.stacked, drive: framed(base.drive, cover, width, height), run: framed(base.run, cover, width, height) };
}
