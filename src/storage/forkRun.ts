import type { Blueprint } from '@/engine/blueprints/types';
import { requireEpisodeInfo, isEpisodeEnv } from '@/engine/env/registry';
import type { CustomSensorSpec } from '@/engine/env/types';
import { InnovationTracker } from '@/engine/neat/innovation';
import { forkGenome } from '@/engine/training/branch';
import type { EpisodeTrainerState } from '@/engine/training/episodeTrainer';
import { newRunId, type RunConfig } from '@/engine/training/runConfig';
import { latestCheckpoint, saveCheckpoint } from './checkpoints';
import { createRun, getRun } from './runs';

/**
 * Grows a trained brain of any registry env: a new run whose population is
 * the original's latest checkpoint with every genome re-mapped onto the new
 * blueprint's inputs. Inputs are matched by their schema keys, so inputs
 * that stay keep their links, new inputs start unconnected and removed
 * inputs disappear. The original run is not touched.
 */
export async function forkRun(runId: string, blueprint: Blueprint, custom: CustomSensorSpec[] = []): Promise<RunConfig> {
  const run = await getRun(runId);
  const cp = await latestCheckpoint(runId);
  if (!run || !isEpisodeEnv(run.config.env)) throw new Error('Only runs of a single population lab can be grown here.');
  if (!cp) throw new Error('Train until the first checkpoint (or pause once) before growing the brain.');
  const old = run.config;
  if (blueprint.env !== old.env) throw new Error(`${blueprint.name} is a ${blueprint.env} brain, not a ${old.env} one.`);
  const info = requireEpisodeInfo(old.env);
  const grown: RunConfig = { ...structuredClone(old), blueprint };
  const oldKeys = info.inputSchema(old, custom).map((s) => s.key);
  const newKeys = info.inputSchema(grown, custom).map((s) => s.key);
  const state = structuredClone(cp.state) as EpisodeTrainerState;
  const tracker = InnovationTracker.fromState(state.population.tracker);
  const remap = <T extends Parameters<typeof forkGenome>[0]>(g: T) => forkGenome(g, oldKeys, newKeys, tracker);
  state.population.genomes = state.population.genomes.map(remap);
  // Species representatives would compare against stale inputs, so speciation starts over.
  state.population.species = [];
  const sample = state.population.genomes[0];
  state.population.template = { ...state.population.template, inputs: sample.inputs, shape: { ...state.population.template.shape, inputCount: newKeys.length } };
  state.population.tracker = tracker.toState();

  const config: RunConfig = {
    ...grown,
    id: newRunId(),
    name: `${old.name} (grown)`,
    createdAt: Date.now(),
    physicsHash: info.physicsHash(grown),
    parent: { runId, generation: cp.generation },
  };
  await createRun(config);
  await saveCheckpoint(config.id, cp.generation, state);
  return config;
}
