import { describe, expect, it } from 'vitest';
import { Network } from '../../neat/network';
import { Population } from '../../neat/population';
import { NAV_FINISHED, NAV_RUNNING } from '../agent';
import { builtinNavigationController } from '../builtinReward';
import { buildCourse } from '../course/build';
import { generateCourse } from '../course/generate';
import { NAMED_COURSES } from '../course/presets';
import { evaluateNavigation } from '../episode';
import { NavigationEnv, type NavigationEnvOptions } from '../env';
import { IDLE_BRAIN, navigatorController } from '../navigator/navigator';
import { navigationInputCount, STANDARD_NAVIGATION_INPUTS, type NavigationInputConfig } from '../sensors/inputConfig';
import { navigationInputSchema } from '../sensors/inputSchema';
import { NAVIGATION_SNAPSHOT, navigationWorldSize, SNAP_STATUS, WORLD_HEADER, WORLD_TIME } from '../snapshot';
import { params } from './helpers';

const course = buildCourse(generateCourse(6, 5), params);

function options(inputs: NavigationInputConfig = STANDARD_NAVIGATION_INPUTS): NavigationEnvOptions {
  return { course, params, inputs, controller: builtinNavigationController };
}

function population(inputs: NavigationInputConfig, size = 20) {
  const n = navigationInputSchema(inputs, params).length;
  return Population.create({ inputCount: n, outputCount: 2, activation: 'tanh', wiring: 'direct' }, 3, { populationSize: size });
}

describe('navigation env', () => {
  it('replays exactly: same brains and seeds give the same episode, alone or in a crowd', () => {
    const pop = population(STANDARD_NAVIGATION_INPUTS);
    const seeds = pop.genomes.map((_, i) => 1000 + i);
    const a = evaluateNavigation(pop.genomes, options(), seeds);
    const b = evaluateNavigation(pop.genomes, options(), seeds);
    expect(a).toEqual(b);
    // The fifth brain run on its own matches its run among all twenty.
    const alone = evaluateNavigation([pop.genomes[4]], options(), [seeds[4]]);
    expect(alone[0]).toEqual(a[4]);
  });

  it('matches the schema length for every input variant', () => {
    const variants: NavigationInputConfig[] = [
      STANDARD_NAVIGATION_INPUTS,
      { ...STANDARD_NAVIGATION_INPUTS, rays: { count: 7, fov: Math.PI, range: 8, hitTypes: false }, pathHint: false, time: false },
      { ...STANDARD_NAVIGATION_INPUTS, rays: { count: 1, fov: 0, range: 12, hitTypes: true }, goal: false, velocity: false },
    ];
    for (const cfg of variants) {
      const schema = navigationInputSchema(cfg, params);
      expect(schema.length).toBe(navigationInputCount(cfg));
      const env = new NavigationEnv(options(cfg));
      const pop = population(cfg, 2);
      env.reset(pop.genomes.map((g) => new Network(g)));
      env.step();
      expect(env.lastObservation(0).length).toBe(schema.length);
      expect(new Set(schema.map((s) => s.key)).size).toBe(schema.length);
      expect(new Set(schema.map((s) => s.label)).size).toBe(schema.length);
      for (const v of env.lastObservation(0)) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('writes snapshots, the world block and a sensible leader', () => {
    const spec = NAMED_COURSES.find((c) => c.id === 'piston-row')!;
    const c = buildCourse(spec, params);
    const env = new NavigationEnv({ course: c, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: navigatorController(c, params) });
    env.reset([IDLE_BRAIN, IDLE_BRAIN, IDLE_BRAIN], [1, 2, 3]);
    const snap = new Float32Array(3 * NAVIGATION_SNAPSHOT.stride);
    const world = new Float32Array(navigationWorldSize());
    for (let t = 0; t < 45; t++) env.step();
    env.snapshot(snap);
    env.writeWorld(world);
    expect(snap[0]).toBeCloseTo(env.agents[0].x, 4);
    expect(snap[SNAP_STATUS]).toBe(NAV_RUNNING);
    expect(world[WORLD_TIME]).toBeCloseTo(1.5, 6);
    expect(world[1]).toBe(3);
    expect(Number.isFinite(world[WORLD_HEADER])).toBe(true);
    const lead = env.leaderIndex();
    expect(env.agents[lead].progress).toBe(Math.max(...env.agents.map((a) => a.progress)));
    while (!env.done) env.step();
    env.snapshot(snap);
    expect(snap[SNAP_STATUS]).toBe(NAV_FINISHED);
    const first = env.agents.reduce((b, a) => (a.finishTime < b.finishTime ? a : b));
    expect(env.leaderIndex()).toBe(first.index);
  });

  it('runs 100 brains on the gauntlet fast enough to train', () => {
    const pop = population(STANDARD_NAVIGATION_INPUTS, 100);
    const env = new NavigationEnv(options());
    env.reset(pop.genomes.map((g) => new Network(g)), pop.genomes.map((_, i) => i));
    const t0 = performance.now();
    let ticks = 0;
    while (!env.done && ticks < 300) {
      env.step();
      ticks++;
    }
    const perTick = (performance.now() - t0) / ticks;
    // A generous bound for a slow test machine: well over 30 ticks a second for the whole population.
    expect(perTick).toBeLessThan(15);
  });
});
