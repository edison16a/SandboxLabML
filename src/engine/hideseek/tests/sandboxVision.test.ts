import { beforeAll, describe, expect, it } from 'vitest';
import { HIDER, HIT_AGENT } from '../agents/agent';
import { emptyRoom, type SandboxRoom } from '../sandbox/room';
import { readSandboxSnapshot, sandboxSnapshotLength } from '../sandbox/snapshot';
import { FLAG_SEEN } from '../snapshot';
import { loadRapier, type Rapier } from '../world/rapier';
import { idleTeam, NO_PREP, place, sandbox } from './sandboxHelpers';

let R: Rapier;
beforeAll(async () => {
  R = await loadRapier();
});

const OPEN = emptyRoom('test', 'Test');
/** A plank across the middle, standing along z, between the seeker at (5, 0) and the hider at (-5, 0). */
const PLANK: SandboxRoom = { ...OPEN, boxes: [{ x: 0, z: 0, yaw: Math.PI / 2, kind: 'plank' }] };

/**
 * Two hiders on the left and two seekers on the right, none of them
 * moving. Seeker 2 faces the hiders; seeker 3 faces away from them.
 */
function standoff(room: SandboxRoom) {
  const m = sandbox(R, { room, hiders: 2, seekers: 2, physics: NO_PREP, hider: idleTeam(), seeker: idleTeam() });
  place(m, 0, { x: -5, z: 0, yaw: 0 });
  place(m, 1, { x: -5, z: 4, yaw: 0 });
  place(m, 2, { x: 5, z: 0, yaw: Math.PI });
  place(m, 3, { x: 5, z: 8, yaw: 0 });
  m.step();
  return m;
}

describe('Sandbox vision', () => {
  it('a hider is seen when any seeker sees it, and each seeker targets the nearest hider it sees', () => {
    const m = standoff(OPEN);
    const [h0, h1, s2, s3] = m.state.agents;
    expect([h0.seen, h1.seen]).toEqual([true, true]);
    expect(s2.seesOpponent).toBe(true);
    expect(m.state.targets[2]).toBe(0);
    // Seeker 3 sees nobody, so its target is simply the nearest hider.
    expect(s3.seesOpponent).toBe(false);
    expect(m.state.targets[3]).toBe(1);
    expect(s3.opponentDistance).toBeCloseTo(Math.hypot(10, 4), 1);
    m.dispose();
  });

  it('a box hides one hider while the other stays seen, and the seeker switches target', () => {
    const m = standoff(PLANK);
    const [h0, h1, s2] = m.state.agents;
    expect(h0.seen).toBe(false);
    expect(h0.hidden).toBe(true);
    expect(h1.seen).toBe(true);
    expect(m.state.targets[2]).toBe(1);
    expect(s2.lastSeenX).toBeCloseTo(-5, 1);
    expect(s2.lastSeenZ).toBeCloseTo(4, 1);
    const out = new Float32Array(sandboxSnapshotLength(4, 1));
    m.snapshot(out);
    const snap = readSandboxSnapshot(out);
    expect(snap.hidersSeen).toBe(1);
    expect(snap.hiders.map((h) => (h.flags & FLAG_SEEN) !== 0)).toEqual([false, true]);
    m.dispose();
  });

  it('rays pass through teammates and stop at opponents', () => {
    const m = sandbox(R, { room: OPEN, hiders: 2, seekers: 1, physics: NO_PREP, hider: idleTeam(), seeker: idleTeam() });
    place(m, 0, { x: -5, z: 0, yaw: 0 });
    place(m, 1, { x: -3, z: 0, yaw: 0 });
    place(m, 2, { x: 5, z: 0, yaw: Math.PI });
    m.step();
    const h0 = m.state.agents[0];
    // Ray 0 points straight ahead, through the teammate at 2 m, to the seeker 10 m away.
    expect(h0.rayHits[0]).toBe(HIT_AGENT);
    expect(h0.rays[0]).toBeCloseTo(10 - m.state.physics.agent.radius, 1);
    m.dispose();
  });
});

describe('Sandbox edits', () => {
  it('a moved box shows in the very next frame, and a locked box stays put', () => {
    // Idle hiders, so none of them unlocks the box; the seekers roam and may shove it.
    const m = sandbox(R, { seed: 4, hider: idleTeam() });
    for (let t = 0; t < 30; t++) m.step();
    m.moveBox(2, 3.5, -2.25);
    const out = new Float32Array(sandboxSnapshotLength(m.state.agents.length, m.state.boxes.length));
    m.snapshot(out);
    expect(readSandboxSnapshot(out).boxes[2].x).toBeCloseTo(3.5, 5);
    expect(readSandboxSnapshot(out).boxes[2].z).toBeCloseTo(-2.25, 5);
    m.setBoxLocked(0, true);
    const { x, z } = m.state.boxes[0];
    for (let t = 0; t < 200 && !m.done; t++) {
      m.step();
      expect(m.state.boxes[0].x).toBe(x);
      expect(m.state.boxes[0].z).toBe(z);
      expect(m.state.boxes[0].lockedBy).toBe(HIDER);
    }
    m.setBoxLocked(0, false);
    m.snapshot(out);
    expect(readSandboxSnapshot(out).boxes[0].locked).toBe(false);
    m.moveBox(99, 0, 0);
    m.dispose();
  });
});
