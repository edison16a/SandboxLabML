import type { InputSpec } from '@/engine/env/types';

/**
 * Inputs that read either side of zero. Driving: how far off the lane and
 * its heading the SUV is, where the path and the bends ahead turn, which
 * way the next turn goes, whether the car ahead pulls away or closes in,
 * and which side a person stands. Navigation: the bearing to the finish,
 * the path hint and sideways speed.
 */
const SIGNED = new Set(['laneOffset', 'headingError', 'aim', 'curveNear', 'curveFar', 'nextTurn', 'carRelSpeed', 'pedLateral', 'goalBearing', 'pathHint', 'sideSpeed']);

/**
 * Whether an input's bar grows both ways from a center line. A bearing to
 * the left reads below zero, for example, which a bar that only fills from
 * the left would show as empty.
 */
export function isSignedInput(spec: Pick<InputSpec, 'group' | 'key'>): boolean {
  return spec.group === 'scalar' && SIGNED.has(spec.key);
}
