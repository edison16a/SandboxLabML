import type { Blueprint } from '../blueprints/types';
import { requireEpisodeModule } from '../env/registry';
import type { EnvId } from '../env/types';
import { neatConfig } from '../neat/config';
import { newRunId, type RunConfig } from './runConfig';

/** What a lab's new run dialog picks for an env added through the registry. */
export interface NewEpisodeRun<S extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  env: EnvId;
  name: string;
  seed: number;
  blueprint: Blueprint;
  populationSize: number;
  /** The env's own options, stored as the run's `settings`. */
  settings: S;
  script?: { source: string; hash: string; customSensors: number };
}

/**
 * The run config of a new run for any registry env. The engine version
 * and physics hash come from the env's module, and the NEAT settings from
 * the blueprint, the same way Racing builds its runs.
 */
export function createEpisodeRunConfig(input: NewEpisodeRun): RunConfig {
  const envModule = requireEpisodeModule(input.env);
  if (input.blueprint.env !== input.env) throw new Error(`${input.blueprint.name} is a ${input.blueprint.env} brain, not a ${input.env} one.`);
  const bp = input.blueprint;
  const config: RunConfig = {
    id: newRunId(),
    name: input.name,
    env: input.env,
    seed: input.seed >>> 0,
    createdAt: Date.now(),
    engineVersion: envModule.engineVersion,
    physicsHash: '',
    blueprint: bp,
    scripts: input.script ? [{ fromGeneration: 0, source: input.script.source, hash: input.script.hash }] : [],
    customSensors: input.script?.customSensors ?? 0,
    neat: neatConfig({
      populationSize: input.populationSize,
      ...(bp.neat ?? {}),
      mutation: { ...neatConfig().mutation, ...(bp.neat?.mutation ?? {}) },
    }),
    settings: input.settings,
  };
  return { ...config, physicsHash: envModule.physicsHash(config) };
}
