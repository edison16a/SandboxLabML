import * as THREE from 'three';
import type { Track } from '@/engine/racing/track/types';

/** Kerbs go wherever the road bends tighter than this radius, m. Shared with the car motion, which feels them. */
export const KERB_RADIUS = 45;
/** Kerb width beyond the road edge, and how far it laps over the edge line, m. */
export const KERB_WIDTH = 1.1;
export const KERB_LAP = 0.15;

/**
 * The kerb's cross section: offsets from the road edge and heights, m. It
 * rises from the asphalt to a rounded crown and steps down at the back,
 * like a real rumble strip, so it catches light on its slope.
 */
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [-KERB_LAP, 0.014],
  [0.12, 0.05],
  [0.45, 0.075],
  [0.85, 0.068],
  [KERB_WIDTH, 0.045],
  [KERB_WIDTH + 0.02, 0.004],
];

/** Height of the kerb top at `across` meters past the road edge, 0 off the kerb. Used to lift a wheel that rides over it. */
export function kerbHeight(across: number): number {
  if (across < PROFILE[0][0] || across > PROFILE[PROFILE.length - 1][0]) return 0;
  for (let k = 1; k < PROFILE.length; k++) {
    const [x1, y1] = PROFILE[k];
    if (across <= x1) {
      const [x0, y0] = PROFILE[k - 1];
      return y0 + ((y1 - y0) * (across - x0)) / (x1 - x0);
    }
  }
  return 0;
}

/** True when sample i of the track has kerbs. */
export function hasKerb(track: Track, i: number): boolean {
  const j = (i + 1) % track.count;
  return Math.max(Math.abs(track.curvature[i]), Math.abs(track.curvature[j])) >= 1 / KERB_RADIUS;
}

/**
 * Red and white kerbs on both edges of every bend, built from the profile.
 * Stripes are 1.6 m long and built as separate quads so their colors stay
 * crisp; normals come from the profile so the crown shades.
 */
export function kerbGeometry(track: Track): THREE.BufferGeometry | null {
  const hw = track.halfWidth;
  const pos: number[] = [];
  const col: number[] = [];
  const red = [0.72, 0.06, 0.06];
  const white = [0.92, 0.92, 0.9];
  const point = (i: number, side: number, across: number, y: number) => {
    const off = side * (hw + across);
    return [track.cx[i] - track.ty[i] * off, y, -(track.cy[i] + track.tx[i] * off)];
  };
  for (let i = 0; i < track.count; i++) {
    if (!hasKerb(track, i)) continue;
    const j = (i + 1) % track.count;
    const color = Math.floor((i * track.spacing) / 1.6) % 2 ? red : white;
    for (const side of [1, -1]) {
      for (let k = 1; k < PROFILE.length; k++) {
        const a0 = point(i, side, PROFILE[k - 1][0], PROFILE[k - 1][1]);
        const a1 = point(i, side, PROFILE[k][0], PROFILE[k][1]);
        const b0 = point(j, side, PROFILE[k - 1][0], PROFILE[k - 1][1]);
        const b1 = point(j, side, PROFILE[k][0], PROFILE[k][1]);
        pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
        // The back step is in shadow under the crown: darken it.
        const shade = k === PROFILE.length - 1 ? 0.55 : 1;
        for (let v = 0; v < 6; v++) col.push(color[0] * shade, color[1] * shade, color[2] * shade);
      }
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // Quads come out wound either way depending on side and direction; point every normal up.
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let v = 0; v < n.count; v++) if (n.getY(v) < 0) n.setXYZ(v, -n.getX(v), -n.getY(v), -n.getZ(v));
  return g;
}
