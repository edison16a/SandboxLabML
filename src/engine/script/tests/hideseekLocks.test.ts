import { describe, expect, it } from 'vitest';
import type { TickIO } from '../../env/types';
import { entriesByName } from '../registry';
import type { BindContext } from '../registry/types';
import { errors, inHideSeekTick } from './helpers';

describe('team lock fields in scripts', () => {
  it('read how many boxes the other team holds locked, straight from the agent', () => {
    const entry = entriesByName('hideseek').get('agent.boxesLockedByOpponent');
    expect(entry?.binding.kind).toBe('num');
    if (entry?.binding.kind !== 'num') return;
    const read = entry.binding.read({} as BindContext);
    expect(read({ boxesLockedByOpponent: 2, boxesLockedByTeam: 1 }, {} as TickIO)).toBe(2);
  });

  it('check in a reward for a vault over a fort the hiders locked', () => {
    expect(errors(inHideSeekTick('  reward +0.5 when agent.isSeeker and agent.justVaulted and agent.boxesLockedByOpponent > 0'))).toEqual([]);
  });
});
