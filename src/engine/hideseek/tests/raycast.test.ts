import { describe, expect, it } from 'vitest';
import { HIT_AGENT, HIT_BOX, HIT_NONE, HIT_RAMP, HIT_WALL } from '../agents/agent';
import { GROUP_AGENT, GROUP_WALL, interactionGroups } from '../world/groups';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { startMatch } from '../match/runMatch';
import type { HideSeekMatch } from '../match/match';
import { rayAabb, rayBox, rayCircle } from '../sensing/raycast2d';
import { hideSeekRayAngles } from '../sensing/rays';
import { createArenaPool } from '../world/pool';
import { CLIMB_RULES, placeBox, placeRamp } from './climbHelpers';
import { idle, randomGenomes, scripted, scriptedMatch } from './helpers';

/**
 * Casts every sensor ray of agent `i` with Rapier and returns distances and
 * hit kinds. Rapier sees the real wedge of a ramp; the engine's rules on
 * top are passing the ramp an agent climbs, and passing every box when it
 * stands high enough to see over them. Groups are always given, since a
 * query without them would also hit the switched off collider of an agent
 * on a ramp.
 */
function rapierRays(m: HideSeekMatch, i: number, count: number, range: number) {
  const arena = m.state.arena;
  const a = m.state.agents[i];
  const kinds = new Map<number, number>();
  arena.agents.forEach((b) => kinds.set(b.collider(0).handle, HIT_AGENT));
  arena.boxes.forEach((b, k) => kinds.set(b.collider(0).handle, m.state.boxes[k].kind === 'ramp' ? HIT_RAMP : HIT_BOX));
  const own = a.climbRamp >= 0 ? arena.boxes[a.climbRamp].collider(0).handle : -1;
  const groups = interactionGroups(0xffff, a.elevation >= m.state.physics.climb.seeOverBoxes ? GROUP_WALL | GROUP_AGENT : 0xffff);
  const ray = new arena.rapier.Ray({ x: a.x, y: m.state.physics.rayHeight, z: a.z }, { x: 1, y: 0, z: 0 });
  return hideSeekRayAngles(count).map((angle) => {
    ray.dir.x = Math.cos(a.yaw + angle);
    ray.dir.z = -Math.sin(a.yaw + angle);
    const hit = arena.world.castRay(ray, range, true, undefined, groups, undefined, arena.agents[i], (c) => c.handle !== own);
    return hit ? { d: hit.timeOfImpact, kind: kinds.get(hit.collider.handle) ?? HIT_WALL } : { d: range, kind: HIT_NONE };
  });
}

describe('2D sensor rays', () => {
  it('handle the basic shapes, including a start inside', () => {
    expect(rayAabb(-5, 0, 1, 0, 0, 0, 1, 1)).toBeCloseTo(4, 12);
    expect(rayAabb(-5, 3, 1, 0, 0, 0, 1, 1)).toBe(Infinity);
    expect(rayAabb(0, 0, 1, 0, 0, 0, 1, 1)).toBe(0);
    expect(rayAabb(5, 0, 1, 0, 0, 0, 1, 1)).toBe(Infinity);
    // A box turned a quarter turn swaps its length and width.
    expect(rayBox(-5, 0, 1, 0, 0, 0, 2, 0.5, Math.cos(Math.PI / 2), Math.sin(Math.PI / 2))).toBeCloseTo(4.5, 12);
    expect(rayCircle(-5, 0, 1, 0, 0, 0, 1)).toBeCloseTo(4, 12);
    expect(rayCircle(-5, 0, -1, 0, 0, 0, 1)).toBe(Infinity);
  });

  it('agree with Rapier ray casts through whole matches', async () => {
    const pool = await createArenaPool();
    const inputs = STANDARD_HIDESEEK_INPUTS;
    const { count, range } = inputs.rays;
    const hiders = randomGenomes(inputs, 6, 31);
    const seekers = randomGenomes(inputs, 6, 32);
    let compared = 0;
    let hits = 0;
    for (let k = 0; k < 6; k++) {
      const layout = (['open', 'shelter', 'corridor'] as const)[k % 3];
      const m = startMatch({ layout, seed: 70 + k, hider: { genome: hiders[k], inputs }, seeker: { genome: seekers[k], inputs } }, pool);
      while (!m.done) {
        m.step();
        // Rapier sees positions as of the latest step, the same moment the 2D rays were cast.
        if (m.tick % 30 !== 0 || m.tick <= m.state.prepTicks) continue;
        for (let i = 0; i < 2; i++) {
          const a = m.state.agents[i];
          rapierRays(m, i, count, range).forEach((r, j) => {
            expect(a.rays[j]).toBeCloseTo(r.d, 3);
            if (Math.abs(a.rays[j] - r.d) < 1e-3 && r.kind !== HIT_NONE) expect(a.rayHits[j]).toBe(r.kind);
            compared++;
            if (r.kind !== HIT_NONE) hits++;
          });
        }
      }
      m.release();
    }
    pool.dispose();
    expect(compared).toBeGreaterThan(1000);
    expect(hits).toBeGreaterThan(compared / 4);
  });

  it('agree with Rapier for a seeker on its way up and over a ramp', async () => {
    const pool = await createArenaPool();
    const { count, range } = STANDARD_HIDESEEK_INPUTS.rays;
    let climbing = 0;
    let high = 0;
    // A ramp turned 30 degrees, with a cube near its lip and another ahead of the hider, so rays meet the slope, crates and walls.
    const m = scriptedMatch(pool, 'open', idle(), scripted(() => ({ move: 1 })), CLIMB_RULES);
    placeRamp(m, 0, 0, Math.PI / 6, true);
    placeBox(m, 0, 2.5, -3);
    placeBox(m, 1, -3, 2);
    const foot = { x: -1.5 * Math.cos(Math.PI / 6), z: 1.5 * Math.sin(Math.PI / 6) };
    m.moveAgent('seeker', foot.x, foot.z, Math.PI / 6);
    m.moveAgent('hider', 4, 3, 0);
    for (let t = 0; t < 70; t++) {
      m.step();
      const a = m.seeker;
      if (a.climbing) climbing++;
      if (a.elevation >= CLIMB_RULES.climb.seeOverBoxes) high++;
      rapierRays(m, 1, count, range).forEach((r, j) => {
        expect(a.rays[j]).toBeCloseTo(r.d, 3);
        if (Math.abs(a.rays[j] - r.d) < 1e-3 && r.kind !== HIT_NONE) expect(a.rayHits[j]).toBe(r.kind);
      });
      // The hider's rays meet the ramp from the floor, and pass the seeker while it is off the floor.
      rapierRays(m, 0, count, range).forEach((r, j) => expect(m.hider.rays[j]).toBeCloseTo(r.d, 3));
    }
    expect(climbing).toBeGreaterThan(20);
    expect(high).toBeGreaterThan(3);
    m.release();
    pool.dispose();
  });
});
