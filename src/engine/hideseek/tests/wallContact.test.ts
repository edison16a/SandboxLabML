import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { distanceToRect } from '../layouts/geometry';
import { getLayout, HIDESEEK_LAYOUT_IDS } from '../layouts/presets';
import type { Rect } from '../layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS as P } from '../physics';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { scripted, scriptedMatch } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** How deep an agent at (x, z) sits inside the deepest wall it touches, m. 0 or less when clear. */
function wallDepth(walls: readonly Rect[], x: number, z: number): number {
  let depth = 0;
  for (const w of walls) depth = Math.max(depth, P.agent.radius - distanceToRect(x, z, w));
  return depth;
}

/**
 * Agents that run flat out and weave never sink into a wall. They used to
 * go about 10 cm in for a tick before the contact caught them, which read
 * on screen as an agent stuck in the wall.
 */
describe('agents against walls', () => {
  it('never sink more than a couple of centimeters into a wall in any room', () => {
    let deepest = 0;
    for (const layout of HIDESEEK_LAYOUT_IDS) {
      for (let seed = 1; seed <= 4; seed++) {
        const weave = scripted((a, t) => ({ move: 1, turn: Math.sin(t / (11 + seed * 3) + a.index) }));
        const m = scriptedMatch(pool, layout, weave, weave, { ...P, prepShare: 0 }, seed);
        while (!m.done) {
          m.step();
          for (const a of m.state.agents) if (!a.climbing && !a.airborne) deepest = Math.max(deepest, wallDepth(m.state.arena.walls, a.x, a.z));
        }
        m.release();
      }
    }
    expect(deepest).toBeLessThan(0.02);
  });

  it('builds every room with the contact settings from the rules', () => {
    const arena = pool.acquire(getLayout('open'), P);
    expect(arena.world.integrationParameters.normalizedPredictionDistance).toBeCloseTo(P.contactPrediction, 5);
    pool.release(arena);
  });
});
