import * as THREE from 'three';

/** Surfaces on a traffic car. */
export type Look = 'paint' | 'seam' | 'glass' | 'trim' | 'plastic' | 'well' | 'grille' | 'plate' | 'head' | 'lens' | 'drl' | 'tail' | 'amber' | 'sign' | 'tire' | 'wall' | 'lip' | 'rim' | 'hub' | 'gap';

/**
 * Which lamp a vertex belongs to, so the shader can light it from the
 * car's flags: tail lamps glow and flare under braking, indicators blink,
 * the high brake light only lights under braking.
 */
export const LAMP = { none: 0, head: 1, tail: 2, left: 3, right: 4, sign: 5, brake: 6 } as const;

/** Base color, roughness, metalness, steady glow and whether the paint color tints it. */
const LOOKS: Record<Look, { color: [number, number, number]; rough: number; metal: number; glow: number; tint: number }> = {
  paint: { color: [1, 1, 1], rough: 0.3, metal: 0.2, glow: 0, tint: 1 },
  seam: { color: [0.22, 0.22, 0.22], rough: 0.6, metal: 0, glow: 0, tint: 1 },
  glass: { color: [0.02, 0.025, 0.03], rough: 0.05, metal: 0.25, glow: 0, tint: 0 },
  trim: { color: [0.012, 0.012, 0.014], rough: 0.22, metal: 0.15, glow: 0, tint: 0 },
  plastic: { color: [0.03, 0.031, 0.034], rough: 0.6, metal: 0, glow: 0, tint: 0 },
  well: { color: [0.008, 0.008, 0.009], rough: 0.95, metal: 0, glow: 0, tint: 0 },
  grille: { color: [0.014, 0.014, 0.016], rough: 0.45, metal: 0.2, glow: 0, tint: 0 },
  plate: { color: [0.62, 0.63, 0.61], rough: 0.5, metal: 0, glow: 0, tint: 0 },
  head: { color: [0.05, 0.055, 0.06], rough: 0.08, metal: 0.4, glow: 0, tint: 0 },
  lens: { color: [0.75, 0.78, 0.8], rough: 0.12, metal: 0.7, glow: 0.12, tint: 0 },
  drl: { color: [1, 0.98, 0.94], rough: 0.3, metal: 0, glow: 1.6, tint: 0 },
  tail: { color: [0.3, 0.012, 0.009], rough: 0.2, metal: 0.1, glow: 0, tint: 0 },
  amber: { color: [0.22, 0.1, 0.03], rough: 0.18, metal: 0.1, glow: 0, tint: 0 },
  sign: { color: [0.98, 0.9, 0.62], rough: 0.4, metal: 0, glow: 1.1, tint: 0 },
  tire: { color: [0.022, 0.022, 0.024], rough: 0.9, metal: 0, glow: 0, tint: 0 },
  wall: { color: [0.046, 0.047, 0.05], rough: 0.8, metal: 0, glow: 0, tint: 0 },
  lip: { color: [0.78, 0.8, 0.82], rough: 0.16, metal: 1, glow: 0, tint: 0 },
  rim: { color: [0.56, 0.58, 0.6], rough: 0.28, metal: 0.95, glow: 0, tint: 0 },
  hub: { color: [0.08, 0.08, 0.085], rough: 0.4, metal: 0.5, glow: 0, tint: 0 },
  gap: { color: [0.012, 0.012, 0.013], rough: 0.7, metal: 0.2, glow: 0, tint: 0 },
};

/**
 * Bakes looks into per vertex attributes: `color`, `surface` (roughness,
 * metalness, glow, tint) and `lamp`. `looks` (and `lamp`) hold one value per vertex,
 * or a single look for the whole part.
 */
export function bakeLook(g: THREE.BufferGeometry, looks: Look[], lamp: number | readonly number[] = LAMP.none): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.attributes.position.count;
  const color = new Float32Array(n * 3);
  const surface = new Float32Array(n * 4);
  const lampAttr = typeof lamp === 'number' ? new Float32Array(n).fill(lamp) : Float32Array.from(lamp);
  // A non indexed copy reorders vertices into triangles, so per vertex looks are read through the old index.
  const index = g.index;
  for (let i = 0; i < n; i++) {
    const src = looks.length === 1 ? 0 : index ? index.getX(i) : i;
    const l = LOOKS[looks[Math.min(src, looks.length - 1)]];
    color.set(l.color, i * 3);
    surface.set([l.rough, l.metal, l.glow, l.tint], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('surface', new THREE.BufferAttribute(surface, 4));
  geo.setAttribute('lamp', new THREE.BufferAttribute(lampAttr, 1));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (geo !== g) g.dispose();
  return geo;
}

/**
 * Paint colors traffic ships in, in sRGB: mostly greys, whites and blacks
 * like a real street, a few blues and reds, the odd green. Taxis are always
 * yellow.
 */
export const TRAFFIC_PAINTS = ['#e8e8e4', '#d9dadb', '#9a9ea3', '#5d6166', '#24272b', '#111214', '#1f3e6e', '#3c5e8c', '#7a1f22', '#a8352b', '#2e4a3a', '#8a7a62', '#c7c2b4', '#4a4f57'].map((c) => new THREE.Color(c));
export const TAXI_PAINT = new THREE.Color('#e0a91c');
