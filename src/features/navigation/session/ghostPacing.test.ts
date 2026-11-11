import { describe, expect, it } from 'vitest';
import { NAV_FINISHED, NAV_RUNNING } from '@/engine/navigation/agent';
import { NAVIGATION_SNAPSHOT, SNAP_STATUS } from '@/engine/navigation/snapshot';
import type { StreamOut } from '@/workers/shared/protocol';
import { allStopped, GhostPacing } from './ghostPacing';

function buffer(statuses: number[]): Float32Array {
  const out = new Float32Array(statuses.length * NAVIGATION_SNAPSHOT.stride);
  statuses.forEach((s, i) => (out[i * NAVIGATION_SNAPSHOT.stride + SNAP_STATUS] = s));
  return out;
}

function frame(statuses: number[]): StreamOut {
  return { kind: 'frame', stream: 'ghosts', generation: 0, tick: 1, count: statuses.length, buffer: buffer(statuses) };
}

const start: StreamOut = { kind: 'start', stream: 'ghosts', generation: 0, count: 2 };

describe('the Turbo ghost pacing', () => {
  it('tells a frame with nobody running', () => {
    expect(allStopped(buffer([NAV_FINISHED, NAV_FINISHED]), 2)).toBe(true);
    expect(allStopped(buffer([NAV_FINISHED, NAV_RUNNING]), 2)).toBe(false);
  });

  it('holds refreshes while a replay plays, then releases one when it ends', () => {
    let released = 0;
    const pacing = new GhostPacing(() => released++);
    expect(pacing.hold()).toBe(false);
    pacing.listen(start);
    pacing.listen(frame([NAV_RUNNING, NAV_RUNNING]));
    expect(pacing.hold()).toBe(true);
    expect(pacing.hold()).toBe(true);
    pacing.listen(frame([NAV_FINISHED, NAV_RUNNING]));
    expect(released).toBe(0);
    pacing.listen(frame([NAV_FINISHED, NAV_FINISHED]));
    // Several held refreshes come out as one.
    expect(released).toBe(1);
    expect(pacing.hold()).toBe(false);
  });

  it('forgets a held refresh when a run opens', () => {
    let released = 0;
    const pacing = new GhostPacing(() => released++);
    pacing.listen(start);
    expect(pacing.hold()).toBe(true);
    pacing.reset();
    pacing.listen(frame([NAV_FINISHED, NAV_FINISHED]));
    expect(released).toBe(0);
  });
});
