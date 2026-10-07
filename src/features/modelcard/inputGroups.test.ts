import { describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '@/engine/blueprints/presets';
import { hideSeekInputSchema } from '@/engine/hideseek/sensing/inputSchema';
import { inputGroups } from './inputGroups';

describe('model card input groups', () => {
  it('fold the Advanced brain into a few named groups with the ramp last', () => {
    const advanced = HIDESEEK_BLUEPRINTS.find((b) => b.id === 'hideseek-advanced')!;
    const groups = inputGroups(hideSeekInputSchema(advanced.inputs));
    expect(groups.map((g) => [g.label, g.count])).toEqual([
      ['Ray distances', 16],
      ['Ray hit types', 32],
      ['Forward speed', 1],
      ['Sideways speed (left)', 1],
      ['Holding a box', 1],
      ['Prep phase', 1],
      ['Time left', 1],
      ['Opponent in sight', 1],
      ['Bearing to last sighting', 1],
      ['Nearest crates', 8],
      ['Nearest ramp', 6],
    ]);
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(69);
    expect(groups[groups.length - 1].inputs).toContain('Facing up the ramp');
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
