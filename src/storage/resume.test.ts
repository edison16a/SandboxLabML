import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { listCheckpoints, saveCheckpoint } from './checkpoints';
import { SandboxDb, setDb } from './db';
import { alignHistory, pickResumeCheckpoint } from './resume';
import { WriteQueue } from './writeQueue';

const cps = (...gens: number[]) => gens.map((generation) => ({ generation }));
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('pickResumeCheckpoint', () => {
  it('takes the newest checkpoint when the history reaches it', () => {
    expect(pickResumeCheckpoint(range(35), cps(10, 20, 30))?.generation).toBe(30);
  });

  it('falls back to an older checkpoint when writes after it were lost', () => {
    // History stops at 165 but checkpoints were saved up to 280.
    expect(pickResumeCheckpoint(range(166), cps(160, 270, 280))?.generation).toBe(160);
  });

  it('starts over when no checkpoint is reachable', () => {
    expect(pickResumeCheckpoint(range(5), cps(260, 270, 280))).toBeUndefined();
    expect(pickResumeCheckpoint([0, 1, 3, 4], cps(3))).toBeUndefined();
  });
});

describe('WriteQueue', () => {
  it('runs writes in order and keeps going after a failure', async () => {
    const q = new WriteQueue();
    const done: string[] = [];
    const slow = q.push(() => new Promise<void>((r) => setTimeout(() => (done.push('a'), r()), 20)));
    const bad = q.push(() => Promise.reject(new Error('disk full')));
    const fast = q.push(async () => void done.push('c'));
    await slow;
    await expect(bad).rejects.toThrow('disk full');
    await fast;
    expect(done).toEqual(['a', 'c']);
  });
});

describe('alignHistory', () => {
  it('resumes from the reachable checkpoint and clears what comes after it', async () => {
    setDb(new SandboxDb('resume-test'));
    for (const g of [10, 20, 30]) await saveCheckpoint('run', g, { g });
    const deleted: number[] = [];
    const history = range(25).map((generation) => ({ generation }));
    const out = await alignHistory('run', history, async (_, from) => void deleted.push(from));
    expect(out.checkpoint?.generation).toBe(20);
    expect(out.history).toHaveLength(20);
    expect(deleted).toEqual([20]);
    expect((await listCheckpoints('run')).map((c) => c.generation)).toEqual([10, 20]);
  });
});
