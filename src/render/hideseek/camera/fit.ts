/** Wall height, m: the tops of the walls must fit in a room shot too. */
const WALL = 2.5;

/**
 * Where a shot may put the room on screen, as shares of the half screen:
 * across, and above and below the middle. Less than 1 keeps clear of the
 * HUD along the edges. `left`, when set, replaces `h` on the left side.
 */
export interface ScreenWindow {
  h: number;
  up: number;
  down: number;
  left?: number;
}

/** The part of the viewport the HUD cards cover in its bottom left corner, as shares of its width and height. */
export interface Cover {
  w: number;
  h: number;
}

/** A framing: how far the camera stands, how far its aim moves toward it and how far to its right, m. */
export interface WindowFit {
  distance: number;
  shift: number;
  lateral: number;
}

/** Gap kept between a HUD card and the framed room, as a share of the half screen. */
const CARD_GAP = 0.04;
/** Steps of each search: a third of the range goes each step, so 40 narrow it a millionfold. */
const STEPS = 40;
/** The beside-the-card search needs fewer steps: it runs a whole search per step. */
const OUTER_STEPS = 24;

/**
 * Smallest camera distance at which a box on the floor, `height` m tall,
 * fits the window from the given elevation, seen from `azimuth` rad round
 * from the +z side, with the aim moved `shift` m toward the camera and
 * `lateral` m to its right. Exact for a perspective camera: each corner
 * gives a bound from its screen x and one from its screen y, and near
 * corners, which look bigger, decide it. Allocates nothing, so a moving
 * shot can call it every frame.
 */
function fitAt(width: number, depth: number, height: number, fovDeg: number, aspect: number, elevation: number, azimuth: number, fill: ScreenWindow, shift: number, lateral: number): number {
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  const right = tan * aspect * fill.h;
  const left = tan * aspect * (fill.left ?? fill.h);
  const dy = Math.sin(elevation);
  const dz = Math.cos(elevation);
  const ca = Math.cos(azimuth);
  const sa = Math.sin(azimuth);
  let best = 0;
  for (let i = 0; i < 4; i++) {
    const cx = (i & 1 ? 0.5 : -0.5) * width;
    const cz = (i & 2 ? 0.5 : -0.5) * depth;
    // The corner in the camera's own frame: x across the screen, z toward the camera.
    const x = cx * ca - cz * sa - lateral;
    const z = cx * sa + cz * ca - shift;
    for (let k = 0; k < 2; k++) {
      const y = k * height;
      const along = y * dy + z * dz;
      const up = y * dz - z * dy;
      const across = x >= 0 ? x / right : -x / left;
      best = Math.max(best, across + along, Math.abs(up) / (tan * (up >= 0 ? fill.up : fill.down)) + along);
    }
  }
  return best;
}

/** Elevation of the overview shots: steep enough to see into every room past its walls, low enough to read heights. */
export const ELEVATION = (60 * Math.PI) / 180;
/** The grid overviews and the top down shot keep clear of the HUD along the top and bottom edges, and may run wider. */
export const FILL: ScreenWindow = { h: 0.94, up: 0.84, down: 0.84 };

/** Smallest camera distance at which a floor rectangle, walls included, fits the view, aimed at its middle. */
export function fitDistance(width: number, depth: number, fovDeg: number, aspect: number, elevation = ELEVATION, azimuth = 0, fill = FILL): number {
  return fitAt(width, depth, WALL, fovDeg, aspect, elevation, azimuth, fill, 0, 0);
}

/**
 * The closest framing of a floor rectangle in a window that need not be
 * centered, for a given sideways aim: writes how far the camera stands and
 * how far its aim moves from the middle toward the camera (negative away)
 * to `out`. The distance only grows as the aim leaves its best place, so
 * a ternary search finds it.
 */
function fitShiftInto(width: number, depth: number, height: number, fovDeg: number, aspect: number, elevation: number, azimuth: number, fill: ScreenWindow, lateral: number, steps: number, out: WindowFit): WindowFit {
  let lo = -Math.max(width, depth) / 2;
  let hi = -lo;
  for (let i = 0; i < steps; i++) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    if (fitAt(width, depth, height, fovDeg, aspect, elevation, azimuth, fill, a, lateral) < fitAt(width, depth, height, fovDeg, aspect, elevation, azimuth, fill, b, lateral)) hi = b;
    else lo = a;
  }
  out.shift = (lo + hi) / 2;
  out.lateral = lateral;
  out.distance = fitAt(width, depth, height, fovDeg, aspect, elevation, azimuth, fill, out.shift, lateral);
  return out;
}

/** The closest framing of a floor rectangle in a window that need not be centered, aimed straight on. */
export function fitWindow(width: number, depth: number, fovDeg: number, aspect: number, elevation: number, azimuth: number, fill: ScreenWindow): { distance: number; shift: number } {
  return fitShiftInto(width, depth, WALL, fovDeg, aspect, elevation, azimuth, fill, 0, 60, { distance: 0, shift: 0, lateral: 0 });
}

/** Scratch for fitClearOf, so a shot that moves every frame allocates nothing. */
const beside: ScreenWindow = { h: 1, up: 1, down: 1, left: 1 };
const above: ScreenWindow = { h: 1, up: 1, down: 1 };
const trial: WindowFit = { distance: 0, shift: 0, lateral: 0 };

/**
 * The closest framing of a box on the floor, `height` m tall, that keeps
 * it clear of a HUD card in the bottom left corner: beside the card (the window's left edge
 * moves right and the aim moves left, so the room sits right of it), or
 * above it (the bottom edge rises), whichever lets the camera stand
 * closer. The sideways aim is a second search round the first; the
 * distance is convex in both, so nesting them finds the best.
 */
export function fitClearOf(width: number, depth: number, height: number, fovDeg: number, aspect: number, elevation: number, azimuth: number, fill: ScreenWindow, cover: Cover, out: WindowFit): WindowFit {
  fitShiftInto(width, depth, height, fovDeg, aspect, elevation, azimuth, fill, 0, STEPS, out);
  if (cover.w <= 0 || cover.h <= 0) return out;
  const free = 1 - 2 * cover.w - CARD_GAP;
  const bottom = Math.min(fill.down, 1 - 2 * cover.h - CARD_GAP);
  // The card's top edge is above the window's bottom: only then does it cover anything.
  if (bottom >= fill.down) return out;
  let best = Infinity;
  if (bottom > 0.15) {
    above.h = fill.h;
    above.up = fill.up;
    above.down = bottom;
    fitShiftInto(width, depth, height, fovDeg, aspect, elevation, azimuth, above, 0, STEPS, out);
    best = out.distance;
  }
  if (free > 0.1) {
    beside.h = fill.h;
    beside.up = fill.up;
    beside.down = fill.down;
    beside.left = free;
    let lo = -Math.max(width, depth);
    let hi = 0;
    for (let i = 0; i < OUTER_STEPS; i++) {
      const a = lo + (hi - lo) / 3;
      const b = hi - (hi - lo) / 3;
      const da = fitShiftInto(width, depth, height, fovDeg, aspect, elevation, azimuth, beside, a, OUTER_STEPS, trial).distance;
      const db = fitShiftInto(width, depth, height, fovDeg, aspect, elevation, azimuth, beside, b, OUTER_STEPS, trial).distance;
      if (da < db) hi = b;
      else lo = a;
    }
    fitShiftInto(width, depth, height, fovDeg, aspect, elevation, azimuth, beside, (lo + hi) / 2, STEPS, trial);
    if (trial.distance < best) {
      out.distance = trial.distance;
      out.shift = trial.shift;
      out.lateral = trial.lateral;
      best = trial.distance;
    }
  }
  // Nothing clears the card (a phone with the setup open): keep the plain fit rather than fly far off.
  if (best === Infinity) fitShiftInto(width, depth, height, fovDeg, aspect, elevation, azimuth, fill, 0, STEPS, out);
  return out;
}
