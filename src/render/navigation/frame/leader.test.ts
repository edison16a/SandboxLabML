import { describe, expect, it } from 'vitest';
import { NAV_DIED, NAV_FINISHED, NAV_RUNNING } from '@/engine/navigation/agent';
import { NAVIGATION_SNAPSHOT, SNAP_PROGRESS, SNAP_STATUS, SNAP_STOP_TIME } from '@/engine/navigation/snapshot';
import { DEATH_BEAT, FINISH_BEAT, LeaderPicker, MIN_HOLD, SWITCH_MARGIN } from './leader';

const S = NAVIGATION_SNAPSHOT.stride;

function snap(rows: Array<[status: number, progress: number, stopTime?: number]>): Float32Array {
  const out = new Float32Array(rows.length * S);
  rows.forEach(([status, progress, stop = 0], i) => {
    out[i * S + SNAP_STATUS] = status;
    out[i * S + SNAP_PROGRESS] = progress;
    out[i * S + SNAP_STOP_TIME] = stop;
  });
  return out;
}

describe('following the best runner', () => {
  it('starts on the furthest runner and holds it through a tight pack', () => {
    const p = new LeaderPicker();
    expect(p.pick(snap([[NAV_RUNNING, 0.2], [NAV_RUNNING, 0.3]]), 2, 0, 1)).toBe(1);
    // Another runner a hair ahead does not take the view.
    expect(p.pick(snap([[NAV_RUNNING, 0.33], [NAV_RUNNING, 0.31]]), 2, MIN_HOLD + 1, 1)).toBe(1);
    // One clearly ahead does, once the hold is over.
    expect(p.pick(snap([[NAV_RUNNING, 0.31 + SWITCH_MARGIN + 0.01], [NAV_RUNNING, 0.31]]), 2, MIN_HOLD + 2, 1)).toBe(0);
  });

  it('stays a beat on a leader that dies, then moves on', () => {
    const p = new LeaderPicker();
    p.pick(snap([[NAV_RUNNING, 0.5], [NAV_RUNNING, 0.4]]), 2, 1, 1);
    expect(p.pick(snap([[NAV_DIED, 0.5, 2], [NAV_RUNNING, 0.4]]), 2, 2 + DEATH_BEAT * 0.5, 1)).toBe(0);
    expect(p.pick(snap([[NAV_DIED, 0.5, 2], [NAV_RUNNING, 0.42]]), 2, 2 + DEATH_BEAT + 0.01, 1)).toBe(1);
  });

  it('stays a beat on a finisher, and settles on the winner when everyone is done', () => {
    const p = new LeaderPicker();
    p.pick(snap([[NAV_RUNNING, 0.9], [NAV_RUNNING, 0.8]]), 2, 1, 1);
    expect(p.pick(snap([[NAV_FINISHED, 1, 5], [NAV_RUNNING, 0.85]]), 2, 5 + FINISH_BEAT * 0.5, 1)).toBe(0);
    expect(p.pick(snap([[NAV_FINISHED, 1, 5], [NAV_RUNNING, 0.9]]), 2, 5 + FINISH_BEAT + 0.01, 1)).toBe(1);
    expect(p.pick(snap([[NAV_FINISHED, 1, 5], [NAV_DIED, 0.95, 7]]), 2, 9, 1)).toBe(0);
  });

  it('starts over on a new episode', () => {
    const p = new LeaderPicker();
    p.pick(snap([[NAV_RUNNING, 0.9], [NAV_RUNNING, 0.1]]), 2, 3, 1);
    expect(p.pick(snap([[NAV_RUNNING, 0.0], [NAV_RUNNING, 0.02]]), 2, 0.1, 2)).toBe(1);
    expect(p.pick(null, 0, 0, 3)).toBe(-1);
  });
});
