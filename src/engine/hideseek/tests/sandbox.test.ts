import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDER } from '../agents/agent';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { startMatch } from '../match/runMatch';
import type { MatchSpec } from '../match/types';
import { HIDESEEK_SNAPSHOT, readArenaSnapshot } from '../snapshot';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { randomGenomes } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

const inputs = STANDARD_HIDESEEK_INPUTS;
const [hider, seeker] = [randomGenomes(inputs, 1, 81)[0], randomGenomes(inputs, 1, 82)[0]];
const spec: MatchSpec = { layout: 'shelter', seed: 14, hider: { genome: hider, inputs }, seeker: { genome: seeker, inputs } };

/** Plays the spec, making the same sandbox edits at ticks 100, 400 and 600. */
function playWithEdits() {
  const m = startMatch(spec, pool);
  const snap = new Float32Array(HIDESEEK_SNAPSHOT.stride);
  const seenRightAway: boolean[] = [];
  while (!m.done) {
    m.step();
    if (m.tick === 100) {
      m.moveBox(2, 6, 6);
      m.snapshot(snap);
      const box = readArenaSnapshot(snap).boxes[2];
      seenRightAway.push(box.x === 6 && box.z === 6);
    }
    if (m.tick === 400) {
      m.setBoxLocked(0, true);
      m.moveAgent('seeker', -8, -8, 0);
      m.snapshot(snap);
      const s = readArenaSnapshot(snap);
      seenRightAway.push(s.boxes[0].locked && s.agents[1].x === -8 && s.agents[1].z === -8);
    }
    if (m.tick === 401) expect(Math.hypot(m.seeker.x + 8, m.seeker.z + 8)).toBeLessThan(0.2);
    if (m.tick === 600) m.setBoxLocked(0, false);
  }
  const out = { result: m.result(), boxes: m.state.boxes.map((b) => ({ ...b })), seenRightAway };
  m.release();
  return out;
}

describe('sandbox edits', () => {
  it('take effect mid match and show in the very next snapshot', () => {
    const run = playWithEdits();
    expect(run.seenRightAway).toEqual([true, true]);
    expect(run.boxes[0].lockedBy).toBe(-1);
  });

  it('replay exactly when made at the same ticks', () => {
    const a = playWithEdits();
    const b = playWithEdits();
    expect(b).toEqual(a);
  });

  it('a locked box stays put until it is unlocked', () => {
    const m = startMatch(spec, pool);
    while (m.tick < 300) m.step();
    m.setBoxLocked(1, true);
    const { x, z } = m.state.boxes[1];
    while (m.tick < 500) {
      m.step();
      expect(m.state.boxes[1].x).toBe(x);
      expect(m.state.boxes[1].z).toBe(z);
      expect(m.state.boxes[1].lockedBy).toBe(HIDER);
    }
    m.release();
  });
});
