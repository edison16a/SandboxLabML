import * as THREE from 'three';

/**
 * Colors for the population. Species get well separated hues from the
 * golden angle, so neighbors in id order never look alike. Ghosts ramp
 * from a faint slate for early generations to the accent blue for recent
 * ones.
 */
export function speciesColor(id: number, out = new THREE.Color()): THREE.Color {
  const hue = ((id * 0.618033988749895) % 1 + 1) % 1;
  return out.setHSL(hue, 0.62, 0.42);
}

/**
 * Real automotive paints, in sRGB, for the followed SUV: a species keeps
 * its own paint, but every one of them is a color a premium SUV ships in.
 */
const PAINTS = ['#1c4f9c', '#e9e9e6', '#8c9196', '#9b1a1f', '#121316', '#2f5a48', '#c2a27a', '#5a6f86', '#b5b8b2', '#6b2a3a', '#d06a2b', '#3d4249'].map((c) => new THREE.Color(c));

export function paintColor(species: number, out = new THREE.Color()): THREE.Color {
  return out.copy(PAINTS[((species % PAINTS.length) + PAINTS.length) % PAINTS.length]);
}

const EARLY = new THREE.Color('#7f8fb0');
const RECENT = new THREE.Color('#4c9aff');

/** `t` is 0 for the oldest ghost and 1 for the newest. */
export function ghostColor(t: number, out = new THREE.Color()): THREE.Color {
  return out.copy(EARLY).lerp(RECENT, t);
}

const GLASS = new THREE.Color('#aab9cb');
/** Share of clear glass mixed into a ghost's hue: enough to read as tinted glass, not colored plastic. */
const GLASS_MIX = 0.55;

/** Mutes a ghost color toward a cool clear glass, in place. */
export function glassTint(c: THREE.Color): THREE.Color {
  return c.lerp(GLASS, GLASS_MIX);
}

/** A crashed SUV turns graphite so the ones still driving stand out. */
export const CRASHED_COLOR = new THREE.Color('#3b3f47');
/** An SUV that arrived glows a calm green. */
export const ARRIVED_COLOR = new THREE.Color('#3fbf7f');
