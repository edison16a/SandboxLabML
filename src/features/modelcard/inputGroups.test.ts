import { describe, expect, it } from 'vitest';
import { SUV } from '@/engine/driving/car/params';
import { FULL_DRIVING_INPUTS } from '@/engine/driving/sensors/inputConfig';
import { drivingInputSchema } from '@/engine/driving/sensors/inputSchema';
import { STANDARD_NAVIGATION_INPUTS } from '@/engine/navigation/sensors/inputConfig';
import { navigationInputSchema } from '@/engine/navigation/sensors/inputSchema';
import { inputGroups } from './inputGroups';

describe('model card input groups', () => {
  it('fold the full Driving brain into its lidar groups and named sensors', () => {
    const groups = inputGroups(drivingInputSchema(FULL_DRIVING_INPUTS, SUV));
    expect(groups.slice(0, 2).map((g) => [g.label, g.count])).toEqual([
      ['Lidar beams', 15],
      ['Lidar hit types', 15],
    ]);
    expect(groups.slice(2).every((g) => g.count === 1)).toBe(true);
    expect(groups.map((g) => g.label)).toContain('Light ahead');
    expect(groups[0].inputs).toContain('Lidar ahead');
  });

  it('fold the Navigation rays and their hit types into three groups', () => {
    const groups = inputGroups(navigationInputSchema(STANDARD_NAVIGATION_INPUTS));
    expect(groups.map((g) => [g.label, g.count])).toEqual([
      ['Ray distances', 12],
      ['Spikes on each ray', 12],
      ['Movers on each ray', 12],
      ['Finish bearing', 1],
      ['Finish distance', 1],
      ['Path hint', 1],
      ['Forward speed', 1],
      ['Side speed', 1],
      ['Time left', 1],
    ]);
  });

  it('keep script sensors together', () => {
    const groups = inputGroups([
      { key: 'speed', label: 'Speed' },
      { key: 'custom:a', label: 'A' },
      { key: 'custom:b', label: 'B' },
    ]);
    expect(groups).toEqual([
      { label: 'Speed', count: 1, inputs: ['Speed'] },
      { label: 'Script sensors', count: 2, inputs: ['A', 'B'] },
    ]);
  });
});
