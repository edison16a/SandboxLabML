import { beforeAll, describe, expect, it } from 'vitest';
import { HIDER, SEEKER } from '../agents/agent';
import { hideSeekBrainInputs } from '../sensing/inputSchema';
import { readSandboxSnapshot, sandboxSnapshotLength } from '../sandbox/snapshot';
import { loadRapier, type Rapier } from '../world/rapier';
import { distanceToRect } from '../layouts/geometry';
import { presetRoom, roomWallRects, SANDBOX_LIMITS } from '../sandbox/room';
import { DRAWN_ROOM, idleBrain, inputs, randomTeam, sandbox } from './sandboxHelpers';

let R: Rapier;
beforeAll(async () => {
  R = await loadRapier();
});

/** Plays `ticks` ticks and keeps every frame. */
function trace(m: ReturnType<typeof sandbox>, ticks: number): Float32Array[] {
  const s = m.state;
  const frames: Float32Array[] = [];
  for (let t = 0; t < ticks && !m.done; t++) {
    m.step();
    const out = new Float32Array(sandboxSnapshotLength(s.agents.length, s.boxes.length));
    m.snapshot(out);
    frames.push(out);
  }
  return frames;
}

describe('Sandbox match', () => {
  it('spawns the asked number of hiders then seekers, each on its own team', () => {
    const m = sandbox(R, { hiders: 4, seekers: 3 });
    const teams = m.state.agents.map((a) => a.index);
    expect(teams).toEqual([HIDER, HIDER, HIDER, HIDER, SEEKER, SEEKER, SEEKER]);
    expect(m.state.boxes.map((b) => b.kind)).toEqual(['cube', 'cube', 'plank', 'plank', 'plank']);
    expect(m.state.arena.agents).toHaveLength(7);
    expect(m.state.arena.boxes).toHaveLength(5);
    m.dispose();
  });

  it('gives every player a brain shaped for exactly its team inputs', () => {
    const m = sandbox(R, { hiders: 2, seekers: 2 });
    for (const b of m.brains) expect(b.inputCount).toBe(hideSeekBrainInputs(inputs));
    m.dispose();
    const wrong = { brain: () => idleBrain(3), inputs, sensors: null };
    expect(() => sandbox(R, { hider: wrong })).toThrow(/inputs/);
  });

  it('replays exactly from the same seed, and spawns differently from another', () => {
    const a = trace(sandbox(R, { seed: 21 }), 400);
    const b = trace(sandbox(R, { seed: 21 }), 400);
    expect(b).toEqual(a);
    const c = trace(sandbox(R, { seed: 22 }), 1);
    expect(Array.from(c[0].subarray(8, 12))).not.toEqual(Array.from(a[0].subarray(8, 12)));
  });

  it('streams a frame whose header says how many players and boxes follow', () => {
    const m = sandbox(R, { hiders: 5, seekers: 2 });
    const [frame] = trace(m, 1);
    expect(frame.length).toBe(8 + 4 * (7 + 5));
    const snap = readSandboxSnapshot(frame);
    expect(snap.hiders).toHaveLength(5);
    expect(snap.seekers).toHaveLength(2);
    expect(snap.boxes.map((b) => b.plank)).toEqual([false, false, true, true, true]);
    expect(snap.hiders[0].x).toBeCloseTo(m.state.agents[0].x, 4);
    expect(snap.seekers[1].z).toBeCloseTo(m.state.agents[6].z, 4);
    m.dispose();
  });

  it('keeps every player out of the drawn walls for a whole match', () => {
    const m = sandbox(R, { hiders: 8, seekers: 8, seed: 5 });
    const walls = roomWallRects(DRAWN_ROOM, m.state.physics);
    while (!m.done) {
      m.step();
      if (m.tick % 30) continue;
      for (const a of m.state.agents) for (const w of walls) expect(distanceToRect(a.x, a.z, w)).toBeGreaterThan(0.25);
    }
    m.dispose();
  });

  it('plays a full match at the limits far faster than real time', () => {
    const boxes = Array.from({ length: SANDBOX_LIMITS.boxes }, (_, i) => ({
      x: -7 + (i % 6) * 2.8,
      z: -8 + Math.floor(i / 6) * 1.5,
      yaw: 0,
      kind: i % 2 ? ('cube' as const) : ('plank' as const),
    }));
    const m = sandbox(R, { room: { ...DRAWN_ROOM, walls: [], boxes }, hiders: 8, seekers: 8 });
    const t0 = performance.now();
    while (!m.done) m.step();
    // 30 s of match time; a worker must keep well ahead of it.
    expect(performance.now() - t0).toBeLessThan(10_000);
    m.dispose();
  });

  it('plays every preset room with eight a side', () => {
    for (const id of ['open', 'shelter', 'corridor'] as const) {
      const m = sandbox(R, { room: presetRoom(id), hiders: 8, seekers: 8, hider: randomTeam(3), seeker: randomTeam(4) });
      trace(m, 120);
      expect(m.tick).toBe(120);
      m.dispose();
    }
  });
});
