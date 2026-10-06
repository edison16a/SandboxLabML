/** A picture in picture rectangle in CSS pixels, from the top left of the viewport. */
export interface PipRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Gap to the viewport edge and between the two views, px. */
const MARGIN = 12;
/** Room left at the bottom for the viewport hint chips, px. */
const BOTTOM = 44;

/**
 * Where the two first person views sit: side by side in the bottom right
 * corner, seeker first. The 3D pass and the DOM frames around them both
 * call this, so the pictures and their labels always line up.
 */
export function pipRects(width: number, height: number): [PipRect, PipRect] {
  const w = Math.round(Math.min(340, Math.max(160, width * 0.19)));
  const h = Math.round(w * 0.6);
  const top = height - BOTTOM - h;
  const right = width - MARGIN;
  return [
    { left: right - 2 * w - MARGIN, top, width: w, height: h },
    { left: right - w, top, width: w, height: h },
  ];
}

/** Agent slot shown in each view: the seeker on the left, the hider on the right. */
export const PIP_AGENTS = [1, 0] as const;
