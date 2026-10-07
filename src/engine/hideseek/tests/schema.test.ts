import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '../../blueprints/presets';
import { Rng } from '../../core/rng';
import { Network } from '../../neat/network';
import { hideSeekInputCount, STANDARD_HIDESEEK_INPUTS, type HideSeekInputConfig } from '../inputConfig';
import { getLayout } from '../layouts/presets';
import { HideSeekMatch } from '../match/match';
import { DEFAULT_HIDESEEK_PHYSICS } from '../physics';
import { v1HideSeekController } from '../rewards';
import { hideSeekInputSchema, HIDESEEK_OUTPUTS } from '../sensing/inputSchema';
import { HideSeekObserver } from '../sensing/observe';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { randomGenomes } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** Plays a few ticks with this config on both teams, then counts what the observer writes. */
function observationLength(cfg: HideSeekInputConfig): number {
  const brain = new Network(randomGenomes(cfg, 1, 5)[0]);
  const team = { brain, inputs: cfg, controller: v1HideSeekController };
  const arena = pool.acquire(getLayout('shelter'), DEFAULT_HIDESEEK_PHYSICS);
  const m = new HideSeekMatch(arena, { seed: 3, hider: team, seeker: team }, () => pool.release(arena));
  for (let t = 0; t < 5; t++) m.step();
  const n = new HideSeekObserver(cfg, DEFAULT_HIDESEEK_PHYSICS).write(m.state, 0, new Float64Array(512), null);
  expect(m.observation(0).length).toBe(n);
  m.release();
  return n;
}

/** A random input config: groups switched on or off, ray counts and box counts varied. */
function randomConfig(rng: Rng): HideSeekInputConfig {
  return {
    rays: { count: 1 + rng.int(24), range: 6 + rng.int(10), hitTypes: rng.chance(0.5) },
    speed: rng.chance(0.5),
    velocity: rng.chance(0.5),
    holding: rng.chance(0.5),
    phase: rng.chance(0.5),
    time: rng.chance(0.5),
    opponentVisible: rng.chance(0.5),
    opponentLastSeen: rng.chance(0.5),
    nearestBoxes: rng.int(6),
    ramp: rng.chance(0.5),
    noise: rng.chance(0.5) ? 0.05 : 0,
  };
}

describe('input schema', () => {
  const rng = new Rng(17);
  const configs: Array<[string, HideSeekInputConfig]> = [
    ...HIDESEEK_BLUEPRINTS.map((b): [string, HideSeekInputConfig] => [b.id, b.inputs]),
    ...Array.from({ length: 5 }, (_, i): [string, HideSeekInputConfig] => [`random mask ${i + 1}`, randomConfig(rng)]),
  ];

  for (const [name, cfg] of configs) {
    it(`matches the observation length for ${name}`, () => {
      const schema = hideSeekInputSchema(cfg);
      expect(schema).toHaveLength(hideSeekInputCount(cfg));
      expect(observationLength(cfg)).toBe(schema.length);
      expect(new Set(schema.map((s) => s.label)).size).toBe(schema.length);
      expect(new Set(schema.map((s) => s.key)).size).toBe(schema.length);
      schema.forEach((s, i) => expect(s.index).toBe(i));
    });
  }

  it('matches the preset sizes: starter 17, standard 61, advanced 69', () => {
    expect(HIDESEEK_BLUEPRINTS.map((b) => hideSeekInputSchema(b.inputs).length)).toEqual([17, 61, 69]);
    expect(HIDESEEK_BLUEPRINTS.every((b) => b.inputs.ramp)).toBe(true);
    expect(HIDESEEK_OUTPUTS.map((o) => o.key)).toEqual(['move', 'turn', 'grab', 'lock']);
  });

  it('spreads rays over the full circle from straight ahead, turning left', () => {
    const rays = hideSeekInputSchema(STANDARD_HIDESEEK_INPUTS).filter((s) => s.ray);
    expect(rays).toHaveLength(16);
    expect(rays[0].label).toBe('Ray ahead');
    expect(rays[4].ray?.angle).toBeCloseTo(Math.PI / 2, 12);
    expect(rays[4].label).toBe('Ray 90° left');
    expect(rays[8].label).toBe('Ray behind');
    expect(rays[12].ray?.angle).toBeCloseTo(-Math.PI / 2, 12);
    expect(rays[12].label).toBe('Ray 90° right');
  });

  it('turning a group off removes exactly that group', () => {
    const base = { ...STANDARD_HIDESEEK_INPUTS, nearestBoxes: 2 };
    const full = hideSeekInputSchema(base);
    const cases: Array<[Partial<HideSeekInputConfig>, number, RegExp]> = [
      [{ rays: { ...base.rays, hitTypes: false } }, 32, /^ray:\d+:(box|agent)$/],
      [{ velocity: false }, 2, /^(forwardSpeed|sideSpeed)$/],
      [{ holding: false }, 1, /^holding$/],
      [{ phase: false }, 1, /^phase$/],
      [{ time: false }, 1, /^timeLeft$/],
      [{ opponentVisible: false }, 1, /^opponentVisible$/],
      [{ opponentLastSeen: false }, 1, /^opponentLastSeen$/],
      [{ nearestBoxes: 0 }, 8, /^box:/],
      [{ ramp: false }, 6, /^ramp:/],
    ];
    for (const [change, removed, keys] of cases) {
      const smaller = hideSeekInputSchema({ ...base, ...change });
      expect(full.length - smaller.length).toBe(removed);
      expect(full.filter((s) => !keys.test(s.key)).map((s) => s.key)).toEqual(smaller.map((s) => s.key));
    }
    // With velocity off, plain speed adds back one input.
    expect(hideSeekInputSchema({ ...base, velocity: false, speed: true }).length).toBe(full.length - 1);
  });
});
