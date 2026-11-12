/** A rectangle in CSS pixels, measured from the top left of the hero. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One scene's share of the hero. The focus is where its subject (the SUV,
 * the runner) should sit, and the zone is how much of the pane
 * is free of the centered text, both as shares of the pane from its top
 * left. The cameras aim at the subject and shift the lens to put it on the
 * focus, and size their shot to the zone.
 */
export interface Pane {
  rect: Rect;
  focusX: number;
  focusY: number;
  zoneW: number;
  zoneH: number;
}

export interface SplitLayout {
  /** Side by side on a wide hero, one above the other on a tall one. */
  stacked: boolean;
  drive: Pane;
  run: Pane;
}

/** The subject never goes closer to a pane's edge than this share, so it is never cut off however wide the text. */
const EDGE = 0.26;
/**
 * Height of the subject in a side by side pane. A little above the middle
 * leaves the bottom corners to the brain cards.
 */
const SIDE_FOCUS_Y = 0.46;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Splits the hero between the two scenes. A wide hero puts the city on
 * the left and the course on the right, a tall one the city on top. Each
 * subject goes in the middle of the part of its pane the text panel
 * leaves free, so the words never sit on the SUV or the runner. Without a panel (not measured yet) the subjects sit centered.
 */
export function splitLayout(width: number, height: number, panel: Rect | null): SplitLayout {
  const stacked = height > width;
  if (!stacked) {
    const half = Math.floor(width / 2);
    // How far the panel leaves each pane free: the city pane up to its left edge, the course pane from its right edge.
    const freeLeft = clamp(panel ? panel.x : half, 0, half);
    const freeRight = clamp(panel ? width - (panel.x + panel.w) : width - half, 0, width - half);
    const driveW = Math.max(1, half);
    const runW = Math.max(1, width - half);
    return {
      stacked,
      drive: { rect: { x: 0, y: 0, w: driveW, h: height }, focusX: clamp(freeLeft / 2 / driveW, EDGE, 0.5), focusY: SIDE_FOCUS_Y, zoneW: clamp(freeLeft / driveW, 2 * EDGE, 1), zoneH: 1 },
      run: { rect: { x: half, y: 0, w: runW, h: height }, focusX: clamp(1 - freeRight / 2 / runW, 0.5, 1 - EDGE), focusY: SIDE_FOCUS_Y, zoneW: clamp(freeRight / runW, 2 * EDGE, 1), zoneH: 1 },
    };
  }
  const half = Math.floor(height / 2);
  const freeTop = clamp(panel ? panel.y : half, 0, half);
  const freeBottom = clamp(panel ? height - (panel.y + panel.h) : height - half, 0, height - half);
  const driveH = Math.max(1, half);
  const runH = Math.max(1, height - half);
  return {
    stacked,
    drive: { rect: { x: 0, y: 0, w: width, h: driveH }, focusX: 0.5, focusY: clamp(freeTop / 2 / driveH, EDGE, 0.5), zoneW: 1, zoneH: clamp(freeTop / driveH, 2 * EDGE, 1) },
    run: { rect: { x: 0, y: half, w: width, h: runH }, focusX: 0.5, focusY: clamp(1 - freeBottom / 2 / runH, 0.5, 1 - EDGE), zoneW: 1, zoneH: clamp(freeBottom / runH, 2 * EDGE, 1) },
  };
}
