import { describe, expect, it } from 'vitest';
import { SUV } from '@/engine/driving/car/params';
import { FULL_DRIVING_INPUTS } from '@/engine/driving/sensors/inputConfig';
import { drivingInputSchema } from '@/engine/driving/sensors/inputSchema';
import { STANDARD_NAVIGATION_INPUTS } from '@/engine/navigation/sensors/inputConfig';
import { navigationInputSchema } from '@/engine/navigation/sensors/inputSchema';
import { isSignedInput } from './signedInputs';

describe('signed input bars', () => {
  it('draw the SUV offsets, turn side and relative speed both ways from zero, and the bends one way', () => {
    const signed = drivingInputSchema(FULL_DRIVING_INPUTS, SUV).filter(isSignedInput).map((s) => s.key);
    expect(signed).toEqual(['laneOffset', 'headingError', 'aim', 'nextTurn', 'carRelSpeed', 'pedLateral']);
    // The observation writes how sharp a bend is, never which way, so a centered bar would hide half its range.
    expect(isSignedInput({ group: 'scalar', key: 'curveNear' })).toBe(false);
  });

  it('draw the runner bearings and sideways speed both ways, and distances one way', () => {
    const signed = navigationInputSchema(STANDARD_NAVIGATION_INPUTS).filter(isSignedInput).map((s) => s.key);
    expect(signed).toEqual(['goalBearing', 'pathHint', 'sideSpeed']);
    expect(isSignedInput({ group: 'scalar', key: 'goalDistance' })).toBe(false);
    expect(isSignedInput({ group: 'ray', key: 'ray:0' })).toBe(false);
  });
});
