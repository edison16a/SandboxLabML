import type * as THREE from 'three';
import { packNormal, pixelTexture } from './pixels';

const COLS = 4;
const ROWS = 4;
/**
 * The tile holds whole rows of hexagons, so it is stretched vertically.
 * Repeat it this much more often along V than along U to get them regular.
 */
export const HONEYCOMB_ASPECT = (2 * COLS) / (Math.sqrt(3) * ROWS);

/**
 * A honeycomb mesh for intakes and the rear grille: thin raised walls
 * around dark hexagonal holes. Color and normal both come from the hex
 * distance to the nearest cell center, so they always line up.
 */
function honeycomb(size: number) {
  const a = size / (2 * COLS);
  const hy = size / ROWS;
  const squash = (Math.sqrt(3) * a) / hy;
  const wall = a * 0.16;
  // One result reused for every texel, so the loops do not allocate. Read it before the next call.
  const best = { d: Infinity, dx: 0, dy: 0 };
  const cellAt = (x: number, y: number) => {
    best.d = Infinity;
    for (let j = -1; j <= ROWS; j++) {
      for (let i = -1; i <= COLS; i++) {
        const dx = x - (i + (j & 1 ? 0.5 : 0)) * 2 * a;
        const dy = (y - j * hy) * squash;
        const d = Math.max(Math.abs(dx), Math.abs(dx) / 2 + (Math.abs(dy) * Math.sqrt(3)) / 2);
        if (d < best.d) {
          best.d = d;
          best.dx = dx;
          best.dy = dy;
        }
      }
    }
    return best;
  };
  // 0 inside a hole, 1 on top of a wall, with a short slope between.
  const height = (d: number) => Math.min(1, Math.max(0, (d - (a - wall)) / (wall * 0.5)));
  return { cellAt, height };
}

/** The mesh's color: dark holes, lighter wall tops. */
export function honeycombColor(size: number): THREE.DataTexture {
  const { cellAt, height } = honeycomb(size);
  return pixelTexture('honeycomb-color', size, true, (x, y, out) => {
    const v = 5 + height(cellAt(x + 0.5, y + 0.5).d) * 36;
    out[0] = v;
    out[1] = v;
    out[2] = v + 2;
  });
}

/** The mesh's normals, which tilt only on the short slopes up the walls. Low skips this map. */
export function honeycombNormal(size: number): THREE.DataTexture {
  const { cellAt, height } = honeycomb(size);
  return pixelTexture('honeycomb-normal', size, false, (x, y, out) => {
    const c = cellAt(x + 0.5, y + 0.5);
    const h = height(c.d);
    const len = Math.hypot(c.dx, c.dy) || 1;
    // The slope from hole up to wall faces back toward the hole's center.
    const k = h > 0 && h < 1 ? -0.7 : 0;
    packNormal((c.dx / len) * k, (c.dy / len) * k, out);
  });
}
