import { beforeAll, describe, expect, it } from 'vitest';
import { SEEKER } from '../agents/agent';
import { setBoxLock } from '../agents/lock';
import { BOX_LOCKED, BOX_RAMP, BOX_SEEKER_LOCK, readSandboxSnapshot, sandboxBoxAt, sandboxSnapshotLength, SANDBOX_BOX_BITS } from '../sandbox/snapshot';
import type { SandboxRoom } from '../sandbox/room';
import { sanitizeRoom } from '../sandbox/validate';
import { FLAG_CLIMBING, LOCK_HIDERS, LOCK_SEEKERS } from '../snapshot';
import { loadRapier, type Rapier } from '../world/rapier';
import { idleBrain, inputs, NO_PREP, place, sandbox } from './sandboxHelpers';
import { randomGenomes } from './helpers';

let R: Rapier;
beforeAll(async () => {
  R = await loadRapier();
});

/** Half the ramp length, m. */
const HALF = 1.2;

/**
 * A drawn room split by a wall along x = -1 (its east face at -0.9), with
 * two ramps on the east side, the first with its lip against the wall,
 * and a cube on the west side.
 */
const RAMP_ROOM: SandboxRoom = {
  id: 'ramps',
  name: 'Ramps',
  walls: [{ from: [-1, -10], to: [-1, 10] }],
  boxes: [
    { x: -0.9 + HALF + 0.05, z: -4, yaw: Math.PI, kind: 'ramp' },
    { x: 5, z: 4, yaw: 0, kind: 'ramp' },
    { x: -4, z: 4, yaw: 0, kind: 'cube' },
  ],
  hiderSpawn: { minX: -9, maxX: -4, minZ: -8, maxZ: -6 },
  seekerSpawn: { minX: 4, maxX: 9, minZ: -8, maxZ: -6 },
};

/** A team whose every player drives straight ahead. */
function forwardTeam() {
  const count = randomGenomes(inputs, 1, 5)[0].inputs.length;
  return { brain: () => ({ ...idleBrain(count), activate: (_i: ArrayLike<number>, out: Float64Array) => (out.fill(0), (out[0] = 1)) }), inputs, sensors: null };
}

describe('the Sandbox with ramps', () => {
  it('keeps ramps when a stored room is read back', () => {
    const read = sanitizeRoom(JSON.parse(JSON.stringify(RAMP_ROOM)));
    expect(read?.boxes.map((b) => b.kind)).toEqual(['ramp', 'ramp', 'cube']);
  });

  it('lets a seeker run up a ramp by a wall and vault into the other half', () => {
    const m = sandbox(R, { room: RAMP_ROOM, hiders: 1, seekers: 2, physics: NO_PREP, hider: forwardTeam(), seeker: forwardTeam() });
    place(m, 0, { x: -8, z: 8, yaw: 0 });
    // The first seeker stands at the foot of the ramp by the wall, facing up it; the second is far off.
    const foot = RAMP_ROOM.boxes[0].x + HALF;
    place(m, 1, { x: foot + 0.3, z: -4, yaw: Math.PI });
    place(m, 2, { x: 8, z: 8, yaw: Math.PI / 2 });
    const frame = new Float32Array(sandboxSnapshotLength(3, 3));
    let climbingFlag = false;
    let vaulted = false;
    for (let t = 0; t < 120 && !vaulted; t++) {
      m.step();
      m.snapshot(frame);
      const snap = readSandboxSnapshot(frame);
      const a = m.state.agents[1];
      expect(snap.seekers[0].elevation).toBeCloseTo(a.elevation, 5);
      climbingFlag ||= (snap.seekers[0].flags & FLAG_CLIMBING) !== 0;
      vaulted = a.justVaulted;
    }
    expect(climbingFlag).toBe(true);
    expect(vaulted).toBe(true);
    expect(m.state.agents[1].x).toBeLessThan(-1.1 - 0.4);
    m.dispose();
  });

  it('streams ramp kinds and who owns each lock', () => {
    const m = sandbox(R, { room: RAMP_ROOM, hiders: 1, seekers: 1, physics: NO_PREP });
    // A user double click locks for the hiders, as before; a seeker's own lock is set the way the engine sets it.
    m.setBoxLocked(1, true);
    setBoxLock(m.state, 0, SEEKER);
    m.step();
    const frame = new Float32Array(sandboxSnapshotLength(2, 3));
    m.snapshot(frame);
    const bits = (b: number) => frame[sandboxBoxAt(2, b) + SANDBOX_BOX_BITS];
    expect(bits(0)).toBe(BOX_RAMP | BOX_LOCKED | BOX_SEEKER_LOCK);
    expect(bits(1)).toBe(BOX_RAMP | BOX_LOCKED);
    expect(bits(2)).toBe(0);
    const snap = readSandboxSnapshot(frame);
    expect(snap.boxes.map((b) => [b.kind, b.lock])).toEqual([
      ['ramp', LOCK_SEEKERS],
      ['ramp', LOCK_HIDERS],
      ['cube', 0],
    ]);
    m.dispose();
  });
});
