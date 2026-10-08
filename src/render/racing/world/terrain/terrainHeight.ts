import { RUNOFF } from '@/engine/racing/car/runtime';
import { fbm, ridged, smoothstep } from '../noise';
import { distanceAt, insideAt, type TrackField } from '../trackField';
import { padWeight, type Pad } from '../../stadium/layout';

/** Ground level next to the road: a touch under the run-off so the two never fight for the same pixels. */
export const GROUND_LEVEL = -0.05;

/** Everything the landscape depends on. Same inputs, same hills. */
export interface TerrainShape {
  field: TrackField;
  pads: Pad[];
  seed: number;
}

/** Distance from the centerline where the ground may start to rise. Wide enough that a coarse mesh never pokes over the barrier. */
export function flatRadius(field: TrackField): number {
  return field.halfWidth + RUNOFF + 8;
}

/**
 * Height of the ground at a world point. The circuit sits on a level
 * shelf; past it the ground rolls into dry hills with rocky spines, and in
 * places a steep bank rises close beside the road, like a cutting through
 * a hillside. The infield stays gentle so top down views read cleanly, and
 * far away a ring of ridged mountains closes the horizon. Pads under
 * buildings are leveled with a soft edge.
 */
export function terrainHeight(shape: TerrainShape, x: number, z: number): number {
  const f = shape.field;
  const seed = shape.seed;
  const d = distanceAt(f, x, z);
  const flat = flatRadius(f);
  const rise = smoothstep(flat, flat + 70, d);
  let h = GROUND_LEVEL;
  if (rise > 0) {
    const inside = insideAt(f, x, z);
    const amp = inside ? 3 + 5 * smoothstep(40, 220, d) : 6 + 44 * smoothstep(30, 420, d);
    const hills = (fbm(x / 240, z / 240, seed, 4) - 0.36) * amp * 2;
    // Rock spines only grow outside the loop, where they frame the circuit.
    const spine = inside ? 0 : Math.max(0, ridged(x / 90, z / 90, seed + 7, 3) - 0.52) * 34 * smoothstep(50, 190, d);
    // Banks: a quick, steep rise just past the verge on some stretches, fading out further away.
    const bankAt = inside ? 0 : Math.max(0, fbm(x / 160, z / 160, seed + 23, 2) - 0.5) * 2;
    const bank = bankAt * 26 * smoothstep(flat + 4, flat + 30, d) * (1 - smoothstep(110, 260, d));
    h += rise * (hills + spine) + bank;
  }
  const far = smoothstep(480, 1700, d);
  if (far > 0) h += far * (30 + ridged(x / 1150, z / 1150, seed + 3, 5) * 330);
  for (let i = 0; i < shape.pads.length; i++) {
    const w = padWeight(shape.pads[i], x, z);
    if (w > 0) h += (GROUND_LEVEL - h) * w;
  }
  return h;
}

/** How rocky the ground looks at a point, 0 to 1, from the same spine noise that raises it. */
export function rockiness(shape: TerrainShape, x: number, z: number): number {
  return smoothstep(0.5, 0.72, ridged(x / 90, z / 90, shape.seed + 7, 3));
}
