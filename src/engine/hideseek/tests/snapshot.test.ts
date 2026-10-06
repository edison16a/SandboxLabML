import { describe, expect, it } from 'vitest';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { startMatch } from '../match/runMatch';
import { BOX_COUNT } from '../physics';
import {
  agentFlags,
  FLAG_FROZEN,
  FLAG_HOLDING,
  FLAG_SEEING,
  FLAG_SEEN,
  HIDESEEK_RAY_SNAPSHOT,
  HIDESEEK_SNAPSHOT,
  readArenaSnapshot,
  SNAPSHOT_RAYS,
} from '../snapshot';
import { createArenaPool } from '../world/pool';
import { randomGenomes } from './helpers';

const f = Math.fround;

describe('arena snapshot', () => {
  it('describes 28 floats with unique field names and distinct flag bits', () => {
    expect(HIDESEEK_SNAPSHOT.stride).toBe(28);
    expect(HIDESEEK_SNAPSHOT.fields).toHaveLength(28);
    expect(new Set(HIDESEEK_SNAPSHOT.fields).size).toBe(28);
    expect(HIDESEEK_RAY_SNAPSHOT.fields).toHaveLength(HIDESEEK_RAY_SNAPSHOT.stride);
    const bits = [FLAG_HOLDING, FLAG_SEEING, FLAG_SEEN, FLAG_FROZEN];
    expect(bits.reduce((a, b) => a | b, 0)).toBe(15);
  });

  it('round-trips 50 arenas written into one buffer', async () => {
    const pool = await createArenaPool();
    const inputs = STANDARD_HIDESEEK_INPUTS;
    const hiders = randomGenomes(inputs, 50, 3);
    const seekers = randomGenomes(inputs, 50, 4);
    const matches = hiders.map((h, i) =>
      startMatch({ layout: (['open', 'shelter', 'corridor'] as const)[i % 3], seed: 40 + i, hider: { genome: h, inputs }, seeker: { genome: seekers[i], inputs } }, pool),
    );
    // Play each arena to a different tick, some still in prep, and lock or move a few boxes by hand.
    matches.forEach((m, i) => {
      for (let t = 0; t < 150 + i * 7; t++) m.step();
      if (i % 4 === 0) m.setBoxLocked(i % BOX_COUNT, true);
      if (i % 5 === 0) m.moveBox(1, -1.5, 2.5);
    });
    const stride = HIDESEEK_SNAPSHOT.stride;
    const buf = new Float32Array(3 + matches.length * stride);
    matches.forEach((m, i) => m.snapshot(buf, 3 + i * stride));

    matches.forEach((m, i) => {
      const s = m.state;
      const snap = readArenaSnapshot(buf, 3 + i * stride);
      expect(snap.time).toBe(f(s.tick * s.physics.dt));
      expect(snap.prep).toBe(s.tick <= s.prepTicks);
      expect(snap.seen).toBe(s.agents[0].seen);
      s.agents.forEach((a, k) => {
        expect(snap.agents[k]).toEqual({ x: f(a.x), z: f(a.z), yaw: f(a.yaw), flags: agentFlags(s, k) });
        expect(!!(snap.agents[k].flags & FLAG_HOLDING)).toBe(a.holding);
        expect(!!(snap.agents[k].flags & FLAG_SEEING)).toBe(a.seesOpponent);
        expect(!!(snap.agents[k].flags & FLAG_SEEN)).toBe(s.agents[1 - k].seesOpponent);
        expect(!!(snap.agents[k].flags & FLAG_FROZEN)).toBe(a.frozen);
      });
      s.boxes.forEach((b, k) => {
        expect(snap.boxes[k]).toEqual({ x: f(b.x), z: f(b.z), yaw: f(b.yaw), locked: b.lockedBy >= 0 });
      });
    });
    expect(matches.some((m) => m.state.boxes.some((b) => b.lockedBy >= 0))).toBe(true);
    expect(matches.some((m) => m.seeker.frozen) && matches.some((m) => !m.seeker.frozen)).toBe(true);
    matches.forEach((m) => m.release());
    pool.dispose();
  });

  it('writes ray hit points at each ray distance from the agent', async () => {
    const pool = await createArenaPool();
    const inputs = STANDARD_HIDESEEK_INPUTS;
    const [h] = randomGenomes(inputs, 1, 5);
    const m = startMatch({ layout: 'shelter', seed: 9, hider: { genome: h, inputs }, seeker: { genome: h, inputs } }, pool);
    for (let t = 0; t < 300; t++) m.step();
    const out = new Float32Array(HIDESEEK_RAY_SNAPSHOT.stride);
    m.snapshotRays(out);
    m.state.agents.forEach((a, i) => {
      for (let k = 0; k < SNAPSHOT_RAYS; k++) {
        const x = out[i * SNAPSHOT_RAYS * 2 + 2 * k];
        const z = out[i * SNAPSHOT_RAYS * 2 + 2 * k + 1];
        expect(Math.hypot(x - a.x, z - a.z)).toBeCloseTo(a.rays[k], 4);
      }
    });
    m.release();
    pool.dispose();
  });
});
