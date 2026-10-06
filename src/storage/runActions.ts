import { mixSeed, Rng } from '@/engine/core/rng';
import { Population } from '@/engine/neat/population';
import { populationFromChampion, trackerFromGenomes } from '@/engine/training/branch';
import type { RacingTrainerState } from '@/engine/training/racingTrainer';
import { newRunId, runShape, scriptAt, type RunConfig } from '@/engine/training/runConfig';
import { saveCheckpoint } from './checkpoints';
import { db } from './db';
import { loadChampion } from './generations';
import { createRun, getRun, trashRun } from './runs';

/** A fresh copy of a run's config with a new identity. */
function cloneConfig(config: RunConfig, patch: Partial<RunConfig>): RunConfig {
  return { ...structuredClone(config), id: newRunId(), createdAt: Date.now(), ...patch };
}

/**
 * Starts a new run from the champion of one generation. Nothing is removed
 * from the original run. The new population is that champion plus mutated
 * copies, and the script version it trained under comes along.
 */
export async function branchRun(runId: string, generation: number): Promise<RunConfig> {
  const run = await getRun(runId);
  const champion = await loadChampion(runId, generation);
  if (!run || !champion) throw new Error('That generation is not stored.');
  const script = scriptAt(run.config, generation);
  const config = cloneConfig(run.config, {
    name: `${run.name} (from gen ${generation + 1})`,
    scripts: script ? [{ ...script, fromGeneration: 0 }] : [],
    parent: { runId, generation },
  });
  const seed = mixSeed(config.seed, generation, 0xb7);
  const genomes = populationFromChampion(champion, config.neat.populationSize, seed);
  const template = { shape: runShape(config), inputs: champion.inputs, outputs: champion.outputs, biasId: champion.biasId, hidden: [] };
  const pop = Population.fromGenomes(genomes, template, trackerFromGenomes([champion]), seed, config.neat);
  await createRun(config);
  if (config.racing) {
    const state: RacingTrainerState = {
      population: pop.toState(),
      track: config.racing.track,
      bestEver: -1e9,
      stagnation: 0,
      scriptRng: new Rng(seed).getState(),
    };
    await saveCheckpoint(config.id, 0, state);
  }
  return config;
}

/**
 * Rewinds to a kept checkpoint. The run as it was goes to Trash for 7 days,
 * and a copy holding only the history up to the checkpoint takes its place.
 */
export async function rewindRun(runId: string, checkpointGeneration: number): Promise<RunConfig> {
  const d = db();
  const run = await getRun(runId);
  const cp = await d.checkpoints.get([runId, checkpointGeneration]);
  if (!run || !cp) throw new Error('That checkpoint is not stored.');
  const config = cloneConfig(run.config, {});
  const gens = (await d.generations.where('runId').equals(runId).toArray()).filter((g) => g.generation < checkpointGeneration);
  await createRun(config);
  await d.generations.bulkPut(gens.map((g) => ({ ...g, runId: config.id })));
  await d.checkpoints.put({ ...cp, runId: config.id });
  const best = gens.reduce((b, g) => Math.max(b, g.champion.fitness), 0);
  await d.runs.update(config.id, { generation: checkpointGeneration, bestFitness: best });
  await trashRun(runId);
  return config;
}

/** Starts over with the same blueprint, script and seed. The old run waits in Trash for 7 days. */
export async function resetRun(runId: string): Promise<RunConfig> {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found.');
  const config = cloneConfig(run.config, {});
  await createRun(config);
  await trashRun(runId);
  return config;
}

/** A new, empty run with the same settings and a fresh seed. */
export async function duplicateRun(runId: string, seed: number): Promise<RunConfig> {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found.');
  const config = cloneConfig(run.config, { name: `${run.name} copy`, seed, parent: undefined });
  await createRun(config);
  return config;
}
