import type { InputSpec } from '@/engine/env/types';

/** Racing inputs that read left or right of zero. */
const RACING_SIGNED = new Set(['headingError', 'steerAngle']);
/** Hide and Seek inputs that read either side of zero: sideways speed, the bearing to a sighting, and the ramp's offsets, facing and lock owner. */
const HIDESEEK_SIGNED = new Set(['sideSpeed', 'opponentLastSeen', 'ramp:ahead', 'ramp:right', 'ramp:uphill', 'ramp:lock']);

/**
 * Whether an input's bar grows both ways from a center line. A ramp
 * locked by the other team reads -1, for example, which a bar that only
 * fills from the left would show as empty.
 */
export function isSignedInput(spec: Pick<InputSpec, 'group' | 'key'>): boolean {
  if (spec.group !== 'scalar') return false;
  if (RACING_SIGNED.has(spec.key) || HIDESEEK_SIGNED.has(spec.key) || spec.key.startsWith('curvature')) return true;
  // The nearest boxes sit ahead or behind, left or right, just like the ramp.
  return /^box:\d+:(ahead|right)$/.test(spec.key);
}
