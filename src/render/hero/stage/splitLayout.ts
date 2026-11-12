/** A rectangle in CSS pixels, measured from the top left of the hero. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One scene's share of the hero. The shot is the picture its camera
 * composes, in its own px; the canvas at `rect` shows the part `view` of
 * it. When the hero frames itself the shot is the canvas and the view is
 * all of it. When it follows a poster frame (see framedLayout), the shot
 * is the pane as the poster was shot and the view is what the window
 * keeps of it. The focus is where the subject (the SUV, the runner)
 * should sit and the zone is how much of the shot is free of the centered
 * text, both as shares of the shot from its top left. The cameras aim at
 * the subject, shift the lens to put it on the focus, and size the shot
 * to the zone.
 */
export interface Pane {
  rect: Rect;
  shot: { w: number; h: number };
  view: Rect;
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

/** A pane whose shot is exactly its canvas. */
function pane(rect: Rect, focusX: number, focusY: number, zoneW: number, zoneH: number): Pane {
  return { rect, shot: { w: rect.w, h: rect.h }, view: { x: 0, y: 0, w: rect.w, h: rect.h }, focusX, focusY, zoneW, zoneH };
}

/**
 * Splits the hero between the two scenes. A wide hero puts the city on
 * the left and the course on the right, a tall one the city on top. Each
 * subject goes in the middle of the part of its pane the text panel
 * leaves free, so the words never sit on the SUV or the runner. Without a
 * panel (not measured yet) the subjects sit centered.
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
      drive: pane({ x: 0, y: 0, w: driveW, h: height }, clamp(freeLeft / 2 / driveW, EDGE, 0.5), SIDE_FOCUS_Y, clamp(freeLeft / driveW, 2 * EDGE, 1), 1),
      run: pane({ x: half, y: 0, w: runW, h: height }, clamp(1 - freeRight / 2 / runW, 0.5, 1 - EDGE), SIDE_FOCUS_Y, clamp(freeRight / runW, 2 * EDGE, 1), 1),
    };
  }
  const half = Math.floor(height / 2);
  const freeTop = clamp(panel ? panel.y : half, 0, half);
  const freeBottom = clamp(panel ? height - (panel.y + panel.h) : height - half, 0, height - half);
  const driveH = Math.max(1, half);
  const runH = Math.max(1, height - half);
  return {
    stacked,
    drive: pane({ x: 0, y: 0, w: width, h: driveH }, 0.5, clamp(freeTop / 2 / driveH, EDGE, 0.5), 1, clamp(freeTop / driveH, 2 * EDGE, 1)),
    run: pane({ x: 0, y: half, w: width, h: runH }, 0.5, clamp(1 - freeBottom / 2 / runH, 0.5, 1 - EDGE), 1, clamp(freeBottom / runH, 2 * EDGE, 1)),
  };
}
