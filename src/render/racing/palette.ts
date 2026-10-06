import * as THREE from 'three';

/**
 * Colors for cars. Species get well separated hues from the golden angle, so
 * neighbors in id order never look alike. Ghost colors ramp from a faint
 * slate for early generations to the accent blue for recent ones.
 */
export function speciesColor(id: number, out = new THREE.Color()): THREE.Color {
  const hue = ((id * 0.618033988749895) % 1 + 1) % 1;
  return out.setHSL(hue, 0.72, 0.46);
}

const EARLY = new THREE.Color('#7f8fb0');
const RECENT = new THREE.Color('#4c9aff');

/** `t` is 0 for the oldest ghost and 1 for the newest. */
export function ghostColor(t: number, out = new THREE.Color()): THREE.Color {
  return out.copy(EARLY).lerp(RECENT, t);
}

export function ghostOpacity(t: number): number {
  return 0.25 + 0.35 * t;
}

export const CRASHED_COLOR = new THREE.Color('#3b3f47');
