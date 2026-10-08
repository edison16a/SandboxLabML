/** A box on screen in CSS pixels, with its top left corner at x and y. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** The smallest box that holds every box given, or null for none. */
export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const b of boxes) {
    left = Math.min(left, b.x);
    top = Math.min(top, b.y);
    right = Math.max(right, b.x + b.w);
    bottom = Math.max(bottom, b.y + b.h);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * The spotlight frame around a target: the target grown by `pad`, then kept
 * `inset` pixels inside the window so the outline stays whole when the
 * target touches an edge. Null when nothing of it is left on screen.
 */
export function frameAround(target: Box, pad: number, view: Size, inset = 2): Box | null {
  const left = Math.max(inset, target.x - pad);
  const top = Math.max(inset, target.y - pad);
  const right = Math.min(view.w - inset, target.x + target.w + pad);
  const bottom = Math.min(view.h - inset, target.y + target.h + pad);
  if (right - left < 4 || bottom - top < 4) return null;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** A hole with no size at the middle of the window, where the spotlight rests when a step frames nothing. */
export function restingHole(view: Size): Box {
  return { x: view.w / 2, y: view.h / 2, w: 0, h: 0 };
}

const n = (v: number) => Math.round(v * 100) / 100;

/** A rounded rectangle as one closed SVG subpath. The radius shrinks to fit small boxes. */
export function roundedRectPath(b: Box, radius: number): string {
  const w = Math.max(0, b.w);
  const h = Math.max(0, b.h);
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const { x, y } = b;
  if (r === 0) return `M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`;
  const arc = (ex: number, ey: number) => `A${n(r)} ${n(r)} 0 0 1 ${n(ex)} ${n(ey)}`;
  return [
    `M${n(x + r)} ${n(y)}`,
    `H${n(x + w - r)}`,
    arc(x + w, y + r),
    `V${n(y + h - r)}`,
    arc(x + w - r, y + h),
    `H${n(x + r)}`,
    arc(x, y + h - r),
    `V${n(y + r)}`,
    arc(x + r, y),
    'Z',
  ].join('');
}

/**
 * The dimmed layer as one SVG path: the whole window, then the hole. Drawn
 * with the evenodd fill rule the hole is left unpainted, so it shows the
 * page and lets clicks through to it.
 */
export function cutoutPath(view: Size, hole: Box, radius: number): string {
  return `M0 0H${n(view.w)}V${n(view.h)}H0Z${roundedRectPath(hole, radius)}`;
}
