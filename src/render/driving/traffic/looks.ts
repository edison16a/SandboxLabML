import * as THREE from 'three';

/** Surfaces on a traffic car. */
export type Look = 'paint' | 'glass' | 'plastic' | 'well' | 'head' | 'tail' | 'amber' | 'sign' | 'tire' | 'rim' | 'hub';

/** Which lamp a vertex belongs to, so the shader can light it from the car's flags. */
export const LAMP = { none: 0, head: 1, tail: 2, left: 3, right: 4, sign: 5 } as const;

/** Base color, roughness, metalness, steady glow and whether the paint color tints it. */
const LOOKS: Record<Look, { color: [number, number, number]; rough: number; metal: number; glow: number; tint: number }> = {
  paint: { color: [1, 1, 1], rough: 0.32, metal: 0.25, glow: 0, tint: 1 },
  glass: { color: [0.025, 0.03, 0.036], rough: 0.06, metal: 0.3, glow: 0, tint: 0 },
  plastic: { color: [0.035, 0.036, 0.04], rough: 0.65, metal: 0, glow: 0, tint: 0 },
  well: { color: [0.01, 0.01, 0.011], rough: 0.95, metal: 0, glow: 0, tint: 0 },
  head: { color: [0.85, 0.88, 0.9], rough: 0.15, metal: 0.4, glow: 0.35, tint: 0 },
  tail: { color: [0.55, 0.03, 0.02], rough: 0.25, metal: 0.1, glow: 0, tint: 0 },
  amber: { color: [0.75, 0.38, 0.05], rough: 0.25, metal: 0.1, glow: 0, tint: 0 },
  sign: { color: [0.95, 0.85, 0.35], rough: 0.4, metal: 0, glow: 0.4, tint: 0 },
  tire: { color: [0.025, 0.025, 0.028], rough: 0.88, metal: 0, glow: 0, tint: 0 },
  rim: { color: [0.62, 0.64, 0.67], rough: 0.3, metal: 0.85, glow: 0, tint: 0 },
  hub: { color: [0.08, 0.08, 0.09], rough: 0.5, metal: 0.4, glow: 0, tint: 0 },
};

/**
 * Bakes looks into per vertex attributes: `color`, `surface` (roughness,
 * metalness, glow, tint) and `lamp`. `looks` holds one look per vertex,
 * or a single look for the whole part.
 */
export function bakeLook(g: THREE.BufferGeometry, looks: Look[], lamp: number = LAMP.none): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.attributes.position.count;
  const color = new Float32Array(n * 3);
  const surface = new Float32Array(n * 4);
  const lampAttr = new Float32Array(n).fill(lamp);
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
