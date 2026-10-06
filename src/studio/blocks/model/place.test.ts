import { describe, expect, it } from 'vitest';
import { fromBlocks, parse, print, toBlocks } from '@/engine/script';
import { paletteFor } from './palette';
import { placeBlock, scopeOfPath } from './place';
import { blockAt } from './paths';

const ws = () => toBlocks(parse('script "t" for racing v1\nlet k = 2\neach tick {\n  reward 1\n  reward 2\n}\n').program);
const item = (scope: 'top' | 'tick' | 'generation', key: string) => paletteFor('racing', scope).flatMap((c) => c.items).find((i) => i.key === key)!.template;

describe('placing palette blocks', () => {
  it('inserts after the selected statement in the same section', () => {
    const selected = [{ list: 'items', index: 1 }, { list: 'body', index: 0 }];
    const placed = placeBlock(ws(), item('tick', 'drive'), 'tick', selected);
    expect(print(fromBlocks(placed.ws))).toContain('reward 1\n  drive(steer: brain.steer, pedal: brain.pedal)\n  reward 2');
    expect(blockAt(placed.ws, placed.select)?.type).toBe('call');
  });

  it('appends to the end of a section otherwise, and creates a missing section', () => {
    const atEnd = placeBlock(ws(), item('tick', 'reward'), 'tick', null);
    expect(print(fromBlocks(atEnd.ws))).toContain('reward 2\n  reward 1\n}');
    const gen = placeBlock(ws(), item('generation', 'speciate'), 'generation', null);
    expect(print(fromBlocks(gen.ws))).toContain('\neach generation {\n  speciate(target: 8)\n}\n');
    expect(scopeOfPath(gen.ws, gen.select)).toBe('generation');
  });

  it('keeps top level blocks above the sections', () => {
    const placed = placeBlock(ws(), item('top', 'sensor'), 'top', null);
    const text = print(fromBlocks(placed.ws));
    expect(text.indexOf('sensor gap')).toBeGreaterThan(text.indexOf('let k'));
    expect(text.indexOf('sensor gap')).toBeLessThan(text.indexOf('each tick'));
  });

  it('selects an existing section instead of adding a second one', () => {
    const placed = placeBlock(ws(), item('top', 'each tick'), 'top', null);
    expect(placed.ws.items).toHaveLength(2);
    expect(placed.select).toEqual([{ list: 'items', index: 1 }]);
  });
});
