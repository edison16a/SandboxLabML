import * as THREE from 'three';
import { HS_COLORS } from './colors';

/** The scene colors as hex live in colors.ts, so 2D code can share them without loading three.js. */
export { HS_COLORS };

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

const NEUTRAL = new THREE.Color('#aeb4bd');

/**
 * Border tint for an arena from its running balance, -1 (seeker ahead) to
 * +1 (hider ahead). Near zero it stays a quiet cool grey, so only a clear
 * lead shows color.
 */
export function balanceColor(balance: number, out: THREE.Color): THREE.Color {
  const t = Math.min(1, Math.abs(balance) * 1.6);
  return out.copy(NEUTRAL).lerp(balance >= 0 ? HS.hider : HS.seeker, t);
}
