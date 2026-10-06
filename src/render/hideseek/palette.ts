import * as THREE from 'three';

/**
 * Colors for the Hide and Seek scene, taken from the theme tokens where the
 * UI has one (hider blue, seeker red) so the 3D and the panels agree. The
 * room is a quiet studio of cool grey concrete and off-white walls, so the
 * team colors and the amber of a locked box are the only saturated things.
 */
export const HS_COLORS = {
  background: '#0b0f16',
  ground: '#11161f',
  floor: '#5b616c',
  gridFloor: '#343a46',
  wall: '#e3e5e9',
  gridWall: '#b7bdc8',
  cube: '#d2b080',
  plank: '#c09a6b',
  locked: '#ffb547',
  hider: '#4c9aff',
  seeker: '#ff5f6d',
  body: '#f2f4f8',
  visor: '#0b0e14',
  sightClear: '#ff4d5e',
  sightBlocked: '#8a94a7',
} as const;

/** The same colors as three.js Colors, created once and never mutated. */
export const HS = Object.fromEntries(Object.entries(HS_COLORS).map(([k, v]) => [k, new THREE.Color(v)])) as Record<keyof typeof HS_COLORS, THREE.Color>;

/** Team color by agent slot: 0 hider, 1 seeker. */
export function teamColor(agent: number): THREE.Color {
  return agent === 0 ? HS.hider : HS.seeker;
}

const NEUTRAL = new THREE.Color('#5d6779');

/**
 * Border tint for an arena from its running balance, -1 (seeker ahead) to
 * +1 (hider ahead). Near zero it stays a quiet grey, so only a clear lead
 * shows color.
 */
export function balanceColor(balance: number, out: THREE.Color): THREE.Color {
  const t = Math.min(1, Math.abs(balance) * 1.6);
  return out.copy(NEUTRAL).lerp(balance >= 0 ? HS.hider : HS.seeker, t);
}
