import { describe, expect, it } from 'vitest';
import { HIDESEEK_SNAPSHOT } from '@/engine/hideseek/snapshot';
import type { StreamOut } from '../shared/protocol';
import { ArenaMerger } from './arenaMerge';
import { ArenaStream } from './arenaStream';

const STRIDE = HIDESEEK_SNAPSHOT.stride;

/** A slice of `count` arenas whose every float is its global arena index plus tick / 1000. */
function slice(first: number, count: number, tick: number): Float32Array {
  const b = new Float32Array(count * STRIDE);
  for (let i = 0; i < count; i++) b.fill(first + i + tick / 1000, i * STRIDE, (i + 1) * STRIDE);
  return b;
}

/** Arena index stored in each arena of a merged buffer. */
function order(buffer: Float32Array): number[] {
  return Array.from({ length: buffer.length / STRIDE }, (_, i) => Math.floor(buffer[i * STRIDE]));
}

describe('ArenaMerger', () => {
  it('assembles slices in match order whatever order they arrive in', () => {
    const m = new ArenaMerger();
    const parts = [
      { first: 0, total: 50, epoch: 1 },
      { first: 25, total: 50, epoch: 1 },
    ];
    m.start(parts[1], 25);
    m.start(parts[0], 25);
    expect(m.frame(parts[1], 25, 3, slice(25, 25, 3))).toBe(-1);
    expect(m.frame(parts[0], 25, 3, slice(0, 25, 3))).toBe(3);
    expect(order(m.buffer)).toEqual(Array.from({ length: 50 }, (_, i) => i));
  });

  it('waits for every slice of a tick and recovers from a dropped frame', () => {
    const m = new ArenaMerger();
    const a = { first: 0, total: 6, epoch: 2 };
    const b = { first: 3, total: 6, epoch: 2 };
    m.start(a, 3);
    expect(m.frame(a, 3, 1, slice(0, 3, 1))).toBe(-1);
    m.start(b, 3);
    expect(m.frame(b, 3, 1, slice(3, 3, 1))).toBe(1);
    // Worker b drops tick 2; tick 3 completes once both have it.
    expect(m.frame(a, 3, 2, slice(0, 3, 2))).toBe(-1);
    expect(m.frame(a, 3, 3, slice(0, 3, 3))).toBe(-1);
    expect(m.frame(b, 3, 3, slice(3, 3, 3))).toBe(3);
  });

  it('drops frames from an older episode and keeps layout tags in place', () => {
    const m = new ArenaMerger();
    m.start({ first: 0, total: 2, epoch: 1 }, 2, Int32Array.from([0, 0]));
    expect(m.start({ first: 2, total: 4, epoch: 5 }, 2, Int32Array.from([2, 2]))).toBe(true);
    expect(m.frame({ first: 0, total: 2, epoch: 1 }, 2, 9, slice(0, 2, 9))).toBe(-1);
    m.start({ first: 0, total: 4, epoch: 5 }, 2, Int32Array.from([1, 1]));
    expect(Array.from(m.tags)).toEqual([1, 1, 2, 2]);
  });
});

/** A fake worker port: records what the stream posts back and lets the test deliver messages. */
function fakePort() {
  const posted: unknown[] = [];
  const port = { onmessage: null as ((e: MessageEvent<StreamOut>) => void) | null, postMessage: (m: unknown) => posted.push(m) };
  return { port: port as unknown as MessagePort, posted, deliver: (msg: StreamOut) => port.onmessage?.({ data: msg } as MessageEvent<StreamOut>) };
}

describe('ArenaStream', () => {
  it('publishes one merged frame per complete tick and returns every slice buffer', () => {
    const p = [fakePort(), fakePort(), fakePort()];
    const stream = new ArenaStream('arenas', p.map((x) => x.port));
    const counts = [17, 17, 16];
    let first = 0;
    const parts = counts.map((count) => {
      const part = { first, total: 50, epoch: 7 };
      first += count;
      return { part, count };
    });
    parts.forEach(({ part, count }, k) => p[k].deliver({ kind: 'start', stream: 'arenas', generation: 4, count, part }));
    for (const tick of [1, 2]) {
      [2, 0, 1].forEach((k) => {
        const { part, count } = parts[k];
        p[k].deliver({ kind: 'frame', stream: 'arenas', generation: 4, tick, count, buffer: slice(part.first, count, tick), part });
      });
    }
    expect(stream.count).toBe(50);
    expect(stream.curr?.tick).toBe(2);
    expect(stream.prev?.tick).toBe(1);
    expect(order(stream.curr!.buffer)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(p.map((x) => x.posted.length)).toEqual([2, 2, 2]);
  });
});
