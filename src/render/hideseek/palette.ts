import * as THREE from 'three';

/**
 * Colors for the Hide and Seek scene, taken from the theme tokens where the
 * UI has one (hider blue, seeker red) so the 3D and the panels agree. The
 * world is bright and airy: a pale haze, light stone underfoot and white
 * plaster walls, so the team colors and the gold crates carry the color.
 */
export const HS_COLORS = {
  /** Sky and haze: the background and the fog the far backdrop fades into. */
  background: '#e6eaef',
  /** The open ground the arenas stand on, a shade darker than their floors so each room reads. */
  ground: '#d2d2d0',
  /** Multiplies the terrazzo texture of the showcase floor. */
  floor: '#fbf8f3',
  gridFloor: '#e7e5e0',
  /** Multiplies the plaster texture of the showcase walls. */
  wall: '#fdfbf7',
  gridWall: '#f8f7f4',
  hider: '#4c9aff',
  seeker: '#ff5f6d',
  sightClear: '#ff4d5e',
  sightBlocked: '#8a94a7',
  /** A sleeping character fades toward this, so a frozen seeker reads as switched off, near and far. */
  dormant: '#9aa0aa',
  /** The soft round shadow under every character and crate. */
  blobShadow: '#1a1712',
  /** The ray of a hovered input: dark ink, since white would vanish on the pale floor and walls. */
  rayHighlight: '#1d2433',
} as const;

/** The same colors as three.js Colors, created once and never mutated. */
export const HS = Object.fromEntries(Object.entries(HS_COLORS).map(([k, v]) => [k, new THREE.Color(v)])) as Record<keyof typeof HS_COLORS, THREE.Color>;

/**
 * Tone mapping for the whole scene. Neutral keeps whites white and the team
 * colors true, where AgX would grey a bright daylight scene down.
 */
export const HS_TONE_MAPPING = THREE.NeutralToneMapping;

/** Team color by agent slot: 0 hider, 1 seeker. */
export function teamColor(agent: number): THREE.Color {
  return agent === 0 ? HS.hider : HS.seeker;
}

const NEUTRAL = new THREE.Color('#bdb5a8');

/**
 * Border tint for an arena from its running balance, -1 (seeker ahead) to
 * +1 (hider ahead). Near zero it stays a quiet stone grey, so only a clear
 * lead shows color.
 */
export function balanceColor(balance: number, out: THREE.Color): THREE.Color {
  const t = Math.min(1, Math.abs(balance) * 1.6);
  return out.copy(NEUTRAL).lerp(balance >= 0 ? HS.hider : HS.seeker, t);
}
