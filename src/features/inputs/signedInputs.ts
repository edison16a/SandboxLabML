import type { InputSpec } from '@/engine/env/types';

/**
 * Inputs that read either side of zero. Driving: how far off the lane and
 * its heading the SUV is, where the path ahead turns, which way the next
 * turn goes, whether the car ahead pulls away or closes in, and which side
 * a person stands. Its two bend inputs say only how sharp a bend is, so
 * they fill one way. Navigation: the bearing to the finish, the path hint
 * and sideways speed.
 */
const SIGNED = new Set(['laneOffset', 'headingError', 'aim', 'nextTurn', 'carRelSpeed', 'pedLateral', 'goalBearing', 'pathHint', 'sideSpeed']);

/**
 * Whether an input's bar grows both ways from a center line. A bearing to
 * the left reads below zero, for example, which a bar that only fills from
 * the left would show as empty.
 */
export function isSignedInput(spec: Pick<InputSpec, 'group' | 'key'>): boolean {
  return spec.group === 'scalar' && SIGNED.has(spec.key);
}
