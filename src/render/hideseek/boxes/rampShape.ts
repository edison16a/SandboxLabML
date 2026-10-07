import * as THREE from 'three';
import type { BoxSize } from '@/engine/hideseek/physics';

/**
 * One panel of the wedge: a convex ring of corners, counterclockwise seen
 * from outside, its outward normal, and how far its middle bulges out
 * along that normal (0 for a flat panel).
 */
export interface RampPanel {
  ring: THREE.Vector3[];
  n: THREE.Vector3;
  bulge: number;
}

/** A straight piece of the frame from a to b, turned so one side faces along `n`. */
export interface RampBar {
  a: THREE.Vector3;
  b: THREE.Vector3;
  n: THREE.Vector3;
}

/**
 * The pattern of a ramp, shared by the close up ramp and the grid ramp so
 * both draw the same thing. The slope is one flat panel crossed by grip
 * treads; the high back face and the high half of each side are faceted
 * panels with braces along their ridges, as on the crates.
 */
export interface RampShape {
  slope: RampPanel;
  /** The low half of each side: too small for braces, so flat and plain, like a crate's narrow faces. */
  plain: RampPanel[];
  /** Faceted panels, braced along their ridges. */
  panels: RampPanel[];
  /** Frame bars along every outer edge. */
  edges: RampBar[];
  /** Posts between neighboring side panels. */
  posts: RampBar[];
  /** Tread center lines across the slope, on its surface. */
  treads: RampBar[];
}

/** Treads start this far up the slope from the foot and repeat this often, m. */
const TREAD_START = 0.3;
const TREAD_EVERY = 0.3;
/** The last tread stays this far below the lip, m, so the lip edge reads on its own. */
const TREAD_END = 0.18;
/** Treads stop short of the side rails by this much, m. */
const TREAD_INSET = 0.075;

/**
 * The wedge standing on the floor, length along local x: the foot (the
 * thin end) at -x, the lip (the high end) at +x, as in the engine. A side
 * triangle splits at its middle into a small triangle under the low half
 * of the slope and a squarish panel under the high half.
 */
export function rampShape(s: BoxSize): RampShape {
  const L = s.length / 2;
  const W = s.width / 2;
  const H = s.height;
  const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const up = v3(2 * L, H, 0).normalize();
  const slopeN = v3(-H, 2 * L, 0).normalize();
  const slope: RampPanel = { ring: [v3(-L, 0, W), v3(L, H, W), v3(L, H, -W), v3(-L, 0, -W)], n: slopeN, bulge: 0 };
  const back: RampPanel = { ring: [v3(L, 0, W), v3(L, 0, -W), v3(L, H, -W), v3(L, H, W)], n: v3(1, 0, 0), bulge: Math.min(W, H / 2) * 0.16 };
  const panels = [back];
  const plain: RampPanel[] = [];
  const posts: RampBar[] = [];
  for (const side of [1, -1]) {
    const z = side * W;
    const n = v3(0, 0, side);
    // Corners seen from outside: counterclockwise on the +z side, so reversed on the -z side.
    const order = (ring: THREE.Vector3[]) => (side > 0 ? ring : ring.reverse());
    plain.push({ ring: order([v3(-L, 0, z), v3(0, 0, z), v3(0, H / 2, z)]), n, bulge: 0 });
    panels.push({ ring: order([v3(0, 0, z), v3(L, 0, z), v3(L, H, z), v3(0, H / 2, z)]), n, bulge: H * 0.06 });
    posts.push({ a: v3(0, 0, z), b: v3(0, H / 2, z), n });
  }
  const edges: RampBar[] = [];
  for (const z of [-W, W]) {
    edges.push({ a: v3(-L, 0, z), b: v3(L, 0, z), n: v3(0, 0, Math.sign(z)) });
    edges.push({ a: v3(-L, 0, z), b: v3(L, H, z), n: slopeN });
    edges.push({ a: v3(L, 0, z), b: v3(L, H, z), n: v3(1, 0, 0) });
  }
  edges.push({ a: v3(L, H, -W), b: v3(L, H, W), n: v3(1, 0, 0) });
  edges.push({ a: v3(L, 0, -W), b: v3(L, 0, W), n: v3(1, 0, 0) });
  edges.push({ a: v3(-L, 0, -W), b: v3(-L, 0, W), n: slopeN });
  const treads: RampBar[] = [];
  const run = Math.hypot(2 * L, H);
  for (let d = TREAD_START; d <= run - TREAD_END; d += TREAD_EVERY) {
    const c = v3(-L, 0, 0).addScaledVector(up, d);
    treads.push({ a: c.clone().setZ(-W + TREAD_INSET), b: c.clone().setZ(W - TREAD_INSET), n: slopeN });
  }
  return { slope, plain, panels, edges, posts, treads };
}

/** The middle of a panel pushed out by its bulge: the apex its facets meet at. */
export function panelApex(p: RampPanel): THREE.Vector3 {
  const apex = new THREE.Vector3();
  for (const q of p.ring) apex.add(q);
  return apex.divideScalar(p.ring.length).addScaledVector(p.n, p.bulge);
}
