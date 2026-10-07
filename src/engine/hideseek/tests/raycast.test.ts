import { describe, expect, it } from 'vitest';
import { HIT_AGENT, HIT_BOX, HIT_NONE, HIT_RAMP, HIT_WALL } from '../agents/agent';
import { GROUP_AGENT, GROUP_WALL, interactionGroups } from '../world/groups';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { startMatch } from '../match/runMatch';
import type { HideSeekMatch } from '../match/match';
import { rayAabb, rayBox, rayCircle } from '../sensing/raycast2d';
import { hideSeekRayAngles } from '../sensing/rays';
import { createArenaPool } from '../world/pool';
import { randomGenomes } from './helpers';

/**
 * Casts every sensor ray of agent `i` with Rapier and returns distances and
 * hit kinds. Rapier sees the real wedge of a ramp; the engine's rules on
 * top are passing the ramp an agent climbs, and passing every box when it
 * stands high enough to see over them.
 */
function rapierRays(m: HideSeekMatch, i: number, count: number, range: number) {
  const arena = m.state.arena;
  const a = m.state.agents[i];
  const kinds = new Map<number, number>();
  arena.agents.forEach((b) => kinds.set(b.collider(0).handle, HIT_AGENT));
  arena.boxes.forEach((b, k) => kinds.set(b.collider(0).handle, m.state.boxes[k].kind === 'ramp' ? HIT_RAMP : HIT_BOX));
  const own = a.climbRamp >= 0 ? arena.boxes[a.climbRamp].collider(0).handle : -1;
  const groups = a.elevation >= m.state.physics.climb.seeOverBoxes ? interactionGroups(0xffff, GROUP_WALL | GROUP_AGENT) : undefined;
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
});
