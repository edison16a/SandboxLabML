import { describe, expect, it } from 'vitest';
import { SUV } from '@/engine/driving/car/params';
import { FULL_DRIVING_INPUTS } from '@/engine/driving/sensors/inputConfig';
import { drivingInputSchema } from '@/engine/driving/sensors/inputSchema';
import { display } from './inputDisplay';

const schema = drivingInputSchema(FULL_DRIVING_INPUTS, SUV);
const spec = (key: string) => {
  const s = schema.find((x) => x.key === key || x.key.startsWith(`${key}:`));
  if (!s) throw new Error(`no input ${key}`);
  return s;
};

describe('inputs panel values', () => {
  it('names the light, the next turn and what a beam hit instead of coded numbers', () => {
    expect(display(spec('light'), 1)).toBe('Red');
    expect(display(spec('light'), 0.5)).toBe('Yellow');
    expect(display(spec('light'), 0)).toBe('Clear');
    expect(display(spec('nextTurn'), -1)).toBe('Left');
    expect(display(spec('nextTurn'), 0)).toBe('Straight');
    expect(display(spec('nextTurn'), 1)).toBe('Right');
    expect(display(spec('lidarKind'), 2 / 3)).toBe('Car');
  });

  it('says none when nothing is in range, and the distance when something is', () => {
    expect(display(spec('carGap'), 1)).toBe('none');
    expect(display(spec('pedDistance'), 1)).toBe('none');
    expect(display(spec('carGap'), 0.3)).toBe('15.0 m');
    expect(display(spec('destination'), 1)).toBe('far');
  });

  it('shows plain amounts as before', () => {
    expect(display(spec('speed'), 0.5)).toBe(`${(SUV.topSpeed / 2).toFixed(SUV.topSpeed / 2 >= 10 ? 1 : 2)} m/s`);
  });
});
