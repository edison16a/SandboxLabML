import { describe, expect, it } from 'vitest';
import { fromBlocks, parse, print, toBlocks, type BlockWorkspace } from '@/engine/script';
import { duplicateBlock, insertBlock, moveBlock, removeBlock, setInput, updateBlock } from './ops';
import { blockAt, ROOT_LIST, shiftPath, type BlockPath } from './paths';

const SOURCE = `script "t" for racing v1

each tick {
  drive(steer: brain.steer, pedal: brain.pedal)
  reward +1 when checkpoint.passed
  if car.speed > 3 m/s {
    reward 0.1
  }
  stop "crash" when car.offTrack
}
`;

const ws = () => toBlocks(parse(SOURCE).program);
const text = (w: BlockWorkspace) => print(fromBlocks(w));
const tick = (index: number): BlockPath => [{ list: 'items', index: 0 }, { list: 'body', index }];
const body = { parent: [{ list: 'items', index: 0 }], list: 'body' };
const lines = (w: BlockWorkspace) =>
  text(w)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('script') && l !== 'each tick {' && l !== '}');

describe('block list operations', () => {
  it('moves a statement down within its list and reports where it landed', () => {
    const moved = moveBlock(ws(), tick(0), body, 3)!;
    expect(lines(moved.ws)).toEqual(['reward +1 when checkpoint.passed', 'if car.speed > 3 m/s {', 'reward 0.1', 'drive(steer: brain.steer, pedal: brain.pedal)', 'stop "crash" when car.offTrack']);
    expect(blockAt(moved.ws, moved.path)?.type).toBe('call');
  });

  it('moves a statement up within its list', () => {
    const moved = moveBlock(ws(), tick(3), body, 0)!;
    expect(lines(moved.ws)[0]).toBe('stop "crash" when car.offTrack');
    expect(blockAt(moved.ws, moved.path)?.type).toBe('stop');
  });

  it('moves a statement into the body of a later if', () => {
    const into = { parent: tick(2), list: 'then' };
    const moved = moveBlock(ws(), tick(0), into, 0)!;
    expect(text(moved.ws)).toContain('if car.speed > 3 m/s {\n    drive(steer: brain.steer, pedal: brain.pedal)\n    reward 0.1\n  }');
    expect(blockAt(moved.ws, moved.path)?.type).toBe('call');
    expect(moved.path).toEqual([...tick(1), { list: 'then', index: 0 }]);
  });

  it('refuses to drop a block inside itself or a statement at the top level', () => {
    expect(moveBlock(ws(), tick(2), { parent: tick(2), list: 'then' }, 0)).toBeNull();
    expect(moveBlock(ws(), tick(0), ROOT_LIST, 0)).toBeNull();
  });

  it('removes, duplicates and inserts', () => {
    const w = ws();
    expect(lines(removeBlock(w, tick(1)))).not.toContain('reward +1 when checkpoint.passed');
    expect(lines(duplicateBlock(w, tick(3))).filter((l) => l.startsWith('stop'))).toHaveLength(2);
    const extra = blockAt(w, tick(1))!;
    expect(lines(insertBlock(w, body, 99, extra)).at(-1)).toBe('reward +1 when checkpoint.passed');
  });

  it('edits a number inside an expression and keeps the rest of the text', () => {
    const cond: BlockPath = [...tick(2), { input: 0 }, { input: 1 }];
    const next = updateBlock(ws(), cond, (b) => ({ ...b, fields: { ...b.fields, value: 5 } }));
    expect(text(next)).toContain('if car.speed > 5 m/s {');
    expect(text(next)).toContain('stop "crash" when car.offTrack');
  });

  it('turns an else if chain into a plain else once it holds two blocks', () => {
    const w = toBlocks(parse(`script "t" for racing v1\neach tick {\n  if car.offTrack {\n    reward -1\n  } else if car.speed > 1 m/s {\n    reward 1\n  }\n}\n`).program);
    const elseList = { parent: tick(0), list: 'else' };
    const extra = blockAt(w, [...tick(0), { list: 'then', index: 0 }])!;
    const next = insertBlock(w, elseList, 1, extra);
    expect(text(next)).toContain('} else {\n    if car.speed > 1 m/s {\n      reward 1\n    }\n    reward -1\n  }');
  });

  it('adds a missing optional argument at the end', () => {
    const w = toBlocks(parse(`script "t" for racing v1\neach generation {\n  keepChampions()\n}\n`).program);
    const bool = { id: 'x', type: 'boolean' as const, fields: { value: false }, inputs: [], children: {}, comment: null };
    expect(text(setInput(w, tick(0), 'enabled', bool))).toContain('keepChampions(enabled: false)');
  });

  it('shifts paths that run through later siblings only', () => {
    expect(shiftPath(tick(3), body, 1, 1)).toEqual(tick(4));
    expect(shiftPath(tick(0), body, 1, 1)).toEqual(tick(0));
    expect(shiftPath(tick(1), body, 1, -1)).toEqual(tick(1));
  });
});
