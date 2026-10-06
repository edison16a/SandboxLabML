import type { RacingBlueprint } from '@/engine/blueprints/types';
import { physicsHash } from '@/engine/racing/car/params';
import { racingInputSchema, type CustomSensorSpec } from '@/engine/racing/sensors/inputSchema';
import { forkGenome } from '@/engine/training/branch';
import { InnovationTracker } from '@/engine/neat/innovation';
import type { RacingTrainerState } from '@/engine/training/racingTrainer';
import { newRunId, type RunConfig } from '@/engine/training/runConfig';
import { latestCheckpoint, saveCheckpoint } from './checkpoints';
import { createRun, getRun } from './runs';

/**
 * Grows a trained racing brain: a new run whose population is the original's
 * latest checkpoint with every genome re-mapped onto the new blueprint's
 * inputs. Inputs that stay keep their links, new inputs start unconnected,
 * removed inputs disappear. The original run is not touched.
 */
export async function forkRacingRun(runId: string, blueprint: RacingBlueprint, custom: CustomSensorSpec[] = []): Promise<RunConfig> {
  const run = await getRun(runId);
  const cp = await latestCheckpoint(runId);
  if (!run?.config.racing) throw new Error('Only racing runs can be grown here.');
  if (!cp) throw new Error('Train until the first checkpoint (or pause once) before growing the brain.');
  const old = run.config;
  if (old.blueprint.env !== 'racing') throw new Error('Blueprint mismatch.');
  const oldKeys = racingInputSchema(old.blueprint.inputs, old.racing!.car, custom).map((s) => s.key);
  const newKeys = racingInputSchema(blueprint.inputs, old.racing!.car, custom).map((s) => s.key);
  const state = structuredClone(cp.state) as RacingTrainerState;
  const tracker = InnovationTracker.fromState(state.population.tracker);
  const remap = <T extends Parameters<typeof forkGenome>[0]>(g: T) => forkGenome(g, oldKeys, newKeys, tracker);
  state.population.genomes = state.population.genomes.map(remap);
  // Species representatives would compare against stale inputs, so speciation starts over.
  state.population.species = [];
  const sample = state.population.genomes[0];
  state.population.template = { ...state.population.template, inputs: sample.inputs, shape: { ...state.population.template.shape, inputCount: newKeys.length } };
  state.population.tracker = tracker.toState();

  const config: RunConfig = {
    ...structuredClone(old),
    id: newRunId(),
    name: `${old.name} (grown)`,
    createdAt: Date.now(),
    blueprint,
    physicsHash: physicsHash(old.racing!.car, { inputs: blueprint.inputs }),
    parent: { runId, generation: cp.generation },
  };
  await createRun(config);
  await saveCheckpoint(config.id, cp.generation, state);
  return config;
}
