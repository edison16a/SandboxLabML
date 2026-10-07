import { describe, expect, it } from 'vitest';
import { STANDARD_HIDESEEK_INPUTS } from '@/engine/hideseek/inputConfig';
import { hideSeekInputSchema } from '@/engine/hideseek/sensing/inputSchema';
import { isSignedInput } from './signedInputs';

describe('signed input bars', () => {
  it('draw the ramp offsets, facing and lock owner both ways from zero, and distances one way', () => {
    const schema = hideSeekInputSchema({ ...STANDARD_HIDESEEK_INPUTS, nearestBoxes: 1 });
    const signed = schema.filter(isSignedInput).map((s) => s.key);
    expect(signed).toEqual(['sideSpeed', 'opponentLastSeen', 'box:1:ahead', 'box:1:right', 'ramp:ahead', 'ramp:right', 'ramp:uphill', 'ramp:lock']);
  });

  it('keeps the racing ones it always had', () => {
    for (const key of ['headingError', 'steerAngle', 'curvatureNear']) expect(isSignedInput({ group: 'scalar', key })).toBe(true);
    expect(isSignedInput({ group: 'scalar', key: 'speed' })).toBe(false);
    expect(isSignedInput({ group: 'ray', key: 'ray:0' })).toBe(false);
  });
});
