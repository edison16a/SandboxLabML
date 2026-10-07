import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getLayout } from '../../hideseek/layouts/presets';
import { HideSeekMatch } from '../../hideseek/match/match';
import { STANDARD_HIDESEEK_INPUTS } from '../../hideseek/inputConfig';
import { hideSeekBrainInputs } from '../../hideseek/sensing/inputSchema';
import { CLIMB_RULES, placeRamp } from '../../hideseek/tests/climbHelpers';
import { idle } from '../../hideseek/tests/helpers';
import { createArenaPool, type ArenaPool } from '../../hideseek/world/pool';
import { Network } from '../../neat/network';
import { Population } from '../../neat/population';
import { createScriptHost } from '../host';
import { errors } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** Drives straight ahead whatever the brain says, pays for a vault, and senses its own elevation. */
const SCRIPT = `script "ramps" for hideseek v1
brain hideseek-standard

sensor height "Elevation" in 0 m .. 3 m = agent.elevation

each tick {
  act(move: 1, turn: 0, grab: 0, lock: 0)
  reward +1 when agent.justVaulted
  reward +0.01 when agent.climbing
  reward -0.5 when agent.airborne and agent.elevation < 0 m
  stop "two vaults" when agent.vaults > 1
  stop "lost the ramp" when agent.nearestRampDistance > 30 m
}
`;

describe('ramp fields in scripts', () => {
  it('compile, and read the climb, the jump and the vault as they happen', () => {
    expect(errors(SCRIPT)).toEqual([]);
    const host = createScriptHost(SCRIPT);
    const inputs = STANDARD_HIDESEEK_INPUTS;
    const shape = { inputCount: hideSeekBrainInputs(inputs, 1), outputCount: 4, activation: 'tanh' as const, wiring: 'direct' as const };
    const brain = new Network(Population.create(shape, 3, { populationSize: 1 }).genomes[0]);
    const controllers = host.createHideSeekControllers(1);
    const arena = pool.acquire(getLayout('shelter'), CLIMB_RULES);
    const hider = { brain, inputs, controller: { ...idle(), customSensorCount: 1, sensors: controllers.hider.sensors } };
    const m = new HideSeekMatch(arena, { seed: 1, hider, seeker: { brain, inputs, controller: controllers.seeker } }, () => pool.release(arena));
    placeRamp(m, -2.9 + CLIMB_RULES.box.ramp.length / 2 + 0.05, -6.5, Math.PI, true);
    m.moveAgent('seeker', 1.5, -6.5, Math.PI);
    m.moveAgent('hider', 6, 6, 0);
    let climbingTicks = 0;
    let sensedTop = 0;
    while (!m.seeker.justVaulted && m.tick < 150) {
      m.step();
      if (m.seeker.climbing) climbingTicks++;
      const obs = m.observation(1);
      sensedTop = Math.max(sensedTop, obs[obs.length - 1]);
    }
    expect(m.seeker.justVaulted).toBe(true);
    expect(m.seeker.vaults).toBe(1);
    // The sensor reads elevation over its 3 m span, and the arc topped out over the wall.
    expect(sensedTop * 3).toBeGreaterThan(CLIMB_RULES.arena.wallHeight);
    expect(m.seeker.fitness).toBeCloseTo(1 + 0.01 * climbingTicks, 9);
    expect(m.seeker.stopReason).toBeNull();
    m.release();
  });
});
