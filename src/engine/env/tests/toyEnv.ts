import { BLUEPRINT_SCHEMA_VERSION, type Blueprint } from '../../blueprints/types';
import { hashObject } from '../../core/hash';
import { TEST_BRAIN_SEED } from '../../lessons/shared';
import { Population } from '../../neat/population';
import type { ChampionRecord } from '../../training/records';
import { envSettings } from '../../training/runConfig';
import type { EpisodeEnvModule } from '../episode';
import type { EnvId } from '../types';
import { toyBuiltin, ToyEnv, type ToyResult, type ToySetup, type ToyWalker } from './toyWalk';

export type { ToyResult, ToySetup } from './toyWalk';

/**
 * A toy env that only the tests register: every agent walks along a line
 * toward a goal 10 m away per level, and a beacon swings back and forth as
 * shared world state. It is small on purpose, so the tests can drive the
 * whole generic pipeline (trainer, sim, ghosts, storage, scripts, lessons)
 * with an env of their own and check every seam of the contract.
 * Its script slice is in toyScript.ts.
 */
export const TOY_ENV = 'toy' as EnvId;
const GOAL = 10;

/** The toy's one optional sensor: the pace it walked last tick, which "Grow this brain" can add. */
const paced = (inputs: unknown) => (inputs as { pace?: boolean }).pace === true;

export const TOY_BLUEPRINT = {
  id: 'toy-basic',
  name: 'Toy',
  env: TOY_ENV,
  tier: 'starter',
  description: 'Distance to the goal and a constant.',
  teaches: 'Nothing; it is a test fixture.',
  schemaVersion: BLUEPRINT_SCHEMA_VERSION,
  readonly: true,
  activation: 'tanh',
  wiring: 'direct',
  inputs: { noise: 0 },
} as unknown as Blueprint;

export const toyModule: EpisodeEnvModule<ToySetup, { level: number }, ToyResult, ChampionRecord> = {
  id: TOY_ENV,
  label: 'Toy',
  engineVersion: 7,
  tickHz: 30,
  snapshot: { stride: 2, fields: ['x', 'stopped'] },
  outputs: [{ index: 0, key: 'move', label: 'Move' }],
  metrics: [
    { key: 'reachedShare', label: 'Reached', unit: '%', source: 'generation', better: 'higher', format: (v) => `${Math.round(v * 100)}%` },
    { key: 'best', label: 'Best', unit: 'm', source: 'champion', better: 'higher', format: (v) => `${v.toFixed(1)} m` },
  ],
  blueprints: [TOY_BLUEPRINT],
  inputCount: (inputs) => 2 + (paced(inputs) ? 1 : 0),
  inputSchema: (config, custom = []) => [
    { index: 0, key: 'goal', label: 'Goal', group: 'scalar', unit: 'm', scale: GOAL, offset: 0 },
    { index: 1, key: 'one', label: 'One', group: 'scalar', unit: '', scale: 1, offset: 0 },
    ...(paced(config.blueprint.inputs) ? [{ index: 2, key: 'pace', label: 'Pace', group: 'scalar' as const, unit: '', scale: 1, offset: 0 }] : []),
    ...custom.map((c, i) => ({ index: 2 + (paced(config.blueprint.inputs) ? 1 : 0) + i, key: `custom:${c.key}`, label: c.label, group: 'custom' as const, unit: c.unit, scale: c.max - c.min, offset: c.min })),
  ],
  physicsHash: (config) => hashObject({ toy: 1, inputs: config.blueprint.inputs }),
  initialContent: () => ({ level: 1 }),
  // A script's toyLevel wins; otherwise the curriculum moves up a level once half the population reaches the goal.
  nextContent: ({ content, metrics, directives }) => {
    const asked = directives.env?.level;
    if (typeof asked === 'number') return asked === content.level ? null : { content: { level: Math.max(1, asked) }, reset: true };
    return (metrics.reachedShare ?? 0) >= 0.5 ? { content: { level: content.level + 1 }, reset: true } : null;
  },
  contentHash: (c) => `level-${c.level}`,
  contentOnRecords: true,
  createSetup: ({ config, content, scriptSource }) => ({ goal: GOAL * content.level, maxTime: envSettings<{ maxTime: number }>(config).maxTime, paced: paced(config.blueprint.inputs), scriptSource }),
  createEnv: (setup, host, seed) => new ToyEnv(setup, host.createController<ToyWalker>({ seed, extra: { goal: setup.goal } }) ?? toyBuiltin),
  championFields: (r) => ({ metrics: { best: r.fitness } }),
  bench: {
    version: 1,
    axes: [{ key: 'reach', label: 'Reach' }],
    hint: 'a longer line, 0 to 100',
    about: 'Never runs in the tests.',
    run: async () => null,
  },
  generationMetrics: (results) => ({ reachedShare: results.filter((r) => r.reached).length / results.length }),
  load: async () => toyModule,
  lessons: {
    testRunName: 'a test walk',
    testRunMetrics: ['distance'],
    brain: 'toy-basic',
    formats: { distance: (v) => `${v.toFixed(1)} m` },
    measure: (r) => ({ distance: r.x }),
    settings: () => ({ maxTime: 5 }),
    // Only the bias drives the output, so every test walk keeps one steady pace.
    testBrain: (shape) => {
      const genome = Population.create({ ...shape, wiring: 'direct' }, TEST_BRAIN_SEED, { populationSize: 1 }).genomes[0];
      for (const c of genome.connections) c.weight = c.from === genome.biasId ? 1 : 0;
      return genome;
    },
    // The toy builds every episode as a ToyEnv, so the cast only names what createEnv returned.
    preview: { scene: (env) => ({ goal: (env as ToyEnv).goal }) },
  },
};
