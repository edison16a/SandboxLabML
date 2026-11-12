import { describe, expect, it } from 'vitest';
import { DRIVING_RADAR_AXES } from '../driving/axes';
import { NAVIGATION_RADAR_AXES } from '../navigation/axes';
import { radarAxesOf, radarValues } from '../radar';

describe('radarValues', () => {
  it('reads the axes of the env module, in their order', () => {
    const values = radarValues('driving', { completion: 0.1, safety: 0.2, efficiency: 0.3, generalization: 0.4 });
    expect(values.map((v) => v.key)).toEqual(DRIVING_RADAR_AXES.map((a) => a.key));
    expect(values.map((v) => v.label)).toEqual(['Completion', 'Safety', 'Efficiency', 'Both cities']);
    expect(values.map((v) => v.value)).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('gives each env its own labels and reads a missing axis as 0', () => {
    expect(radarAxesOf('navigation')).toEqual(NAVIGATION_RADAR_AXES);
    const values = radarValues('navigation', { completion: 0.5, safety: 0.25 });
    expect(values.find((v) => v.key === 'safety')?.value).toBe(0.25);
    expect(values.find((v) => v.key === 'efficiency')?.value).toBe(0);
    expect(values.at(-1)?.label).toBe('Generalization');
  });
});
