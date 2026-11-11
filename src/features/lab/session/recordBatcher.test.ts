import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationRecord } from '@/engine/training/records';
import { RecordBatcher } from './recordBatcher';

const rec = (generation: number) => ({ generation }) as GenerationRecord;

describe('RecordBatcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delivers a lone record right away and groups a burst behind it', () => {
    const batches: number[][] = [];
    const b = new RecordBatcher((batch) => batches.push(batch.map((r) => r.generation)), 500);
    b.push(rec(0));
    vi.advanceTimersByTime(0);
    expect(batches).toEqual([[0]]);
    b.push(rec(1));
    b.push(rec(2));
    vi.advanceTimersByTime(499);
    expect(batches).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(batches).toEqual([[0], [1, 2]]);
  });

  it('flushes on demand and drops waiting records on clear', () => {
    const batches: number[][] = [];
    const b = new RecordBatcher((batch) => batches.push(batch.map((r) => r.generation)), 500);
    b.push(rec(0));
    b.flush();
    b.push(rec(1));
    b.clear();
    vi.advanceTimersByTime(1000);
    expect(batches).toEqual([[0]]);
  });
});
