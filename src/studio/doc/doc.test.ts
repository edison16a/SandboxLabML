import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';
import { canRedo, canUndo, commit, createHistory, GROUP_WINDOW_MS, HISTORY_DEPTH, redo, seal, undo } from './history';
import { appendToSection, insertBelowLine } from './insert';
import { lineCol, minimalChange } from './textChange';

describe('document history', () => {
  it('undoes and redoes whole states and drops the redo branch on a new edit', () => {
    let h = createHistory('a');
    h = commit(h, 'ab', { at: 0 });
    h = commit(h, 'abc', { at: 10_000 });
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe('ab');
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe('abc');
    h = commit(undo(h), 'abX', { at: 20_000 });
    expect(canRedo(h)).toBe(false);
    expect(undo(undo(h)).present).toBe('a');
  });

  it('merges a burst of typing into one step and splits it after a pause or a seal', () => {
    let h = createHistory('');
    h = commit(h, 'r', { group: 'typing', at: 0 });
    h = commit(h, 're', { group: 'typing', at: 200 });
    h = commit(h, 'rew', { group: 'typing', at: 400 });
    expect(undo(h).present).toBe('');
    h = commit(h, 'rewa', { group: 'typing', at: 400 + GROUP_WINDOW_MS + 1 });
    expect(undo(h).present).toBe('rew');
    h = commit(seal(h), 'rewar', { group: 'typing', at: 400 + GROUP_WINDOW_MS + 2 });
    expect(undo(h).present).toBe('rewa');
  });

  it('ignores commits that change nothing and caps the depth', () => {
    let h = createHistory('x');
    expect(commit(h, 'x')).toBe(h);
    for (let i = 0; i < HISTORY_DEPTH + 20; i++) h = commit(h, `x${i}`);
    expect(h.past).toHaveLength(HISTORY_DEPTH);
  });
});

describe('text changes', () => {
  it('finds the smallest replacement', () => {
    expect(minimalChange('reward 1 when x', 'reward 2 when x')).toEqual({ from: 7, to: 8, insert: '2' });
    expect(minimalChange('aaa', 'aaaa')).toEqual({ from: 3, to: 3, insert: 'a' });
    expect(minimalChange('same', 'same')).toBeNull();
  });

  it('reports 1-based lines and columns', () => {
    expect(lineCol('ab\ncd', 4)).toEqual({ line: 2, col: 2 });
    expect(lineCol('', 0)).toEqual({ line: 1, col: 1 });
  });
});

describe('inserting examples', () => {
  const src = 'script "t" for racing v1\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n}\n';

  it('inserts below the cursor line with its indentation, or one deeper after a brace', () => {
    const afterDrive = insertBelowLine(src, src.indexOf('drive'), 'reward 1');
    expect(afterDrive.text).toContain('pedal)\n  reward 1\n}');
    const afterBrace = insertBelowLine(src, src.indexOf('{'), 'reward 1');
    expect(afterBrace.text).toContain('each tick {\n  reward 1\n  drive');
  });

  it('appends to a section and creates it when missing', () => {
    expect(appendToSection(src, 'tick', 'reward +1 when checkpoint.passed')).toContain('pedal: brain.pedal)\n  reward +1 when checkpoint.passed\n}');
    const gen = appendToSection(src, 'generation', 'speciate(target: 8)');
    expect(gen).toContain('\neach generation {\n  speciate(target: 8)\n}\n');
    expect(appendToSection('script "t" for racing v1\neach tick {\n', 'tick', 'reward 1')).toBeNull();
  });
});

describe('analysis', () => {
  it('counts problems, finds the first syntax error and estimates cost', () => {
    const ok = analyze('script "t" for racing v1\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n}\n');
    expect(ok.syntaxError).toBeNull();
    expect(ok.counts.error).toBe(0);
    expect(ok.micros).toBeGreaterThan(0);
    expect(ok.turboShare).toBeGreaterThan(0.9);
    const broken = analyze('script "t" for racing v1\neach tick {\n  reward (1\n}\n');
    expect(broken.syntaxError).not.toBeNull();
    expect(broken.cost).toBeNull();
  });
});
