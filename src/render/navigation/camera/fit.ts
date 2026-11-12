/** Height above the floor a room shot keeps in view, m, so the walls, the gate and the runners fit. */
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

/** Elevation of the overview shots: steep enough to see past the walls into the room, low enough to read heights. */
export const ELEVATION = (60 * Math.PI) / 180;
/** The overview and the top down shot keep clear of the HUD along the top and bottom edges, and may run wider. */
export const FILL: ScreenWindow = { h: 0.94, up: 0.84, down: 0.84 };

/** Smallest camera distance at which a floor rectangle, walls included, fits the view, aimed at its middle. */
export function fitDistance(width: number, depth: number, fovDeg: number, aspect: number, elevation = ELEVATION, azimuth = 0, fill = FILL): number {
  return fitAt(width, depth, WALL, fovDeg, aspect, elevation, azimuth, fill, 0, 0);
}
