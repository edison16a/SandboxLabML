import type { Remote } from 'comlink';
// Plugs the script compiler in, as every worker does, so runs with a script train here too.
import '../../src/workers/shared/loadScripts';
import { findPresetBlueprint } from '../../src/engine/blueprints/presets';
import { loadEpisodeModule } from '../../src/engine/env/registry';
import type { NavigationBlueprint } from '../../src/engine/navigation/pipeline/blueprints';
import { NAV_METRIC } from '../../src/engine/navigation/pipeline/metricSpecs';
import { navigationSettings, type NavigationSettings } from '../../src/engine/navigation/pipeline/settings';
import { createEpisodeRunConfig } from '../../src/engine/training/newRun';
import type { GenerationRecord } from '../../src/engine/training/records';
import { EpisodeCoordinator } from '../../src/workers/coordinator/episodeCoordinator';
import type { CoordinatorEvent } from '../../src/workers/coordinator/events';
import { EpisodeSim } from '../../src/workers/sim/episodeSim';
import type { SimApi } from '../../src/workers/sim/sim.worker';

export interface PipelineRunOptions {
  seed: number;
  generations: number;
  population?: number;
  blueprint?: string;
  /** Sim workers the coordinator splits the population over. Here they share one thread, as the code path is what matters. */
  workers?: number;
  settings?: Partial<NavigationSettings>;
  /** NEAT overrides on top of the blueprint's, for tuning experiments. */
  neat?: NavigationBlueprint['neat'];
  /** Changes to the blueprint itself, such as hidden layers. */
  brain?: Partial<Pick<NavigationBlueprint, 'wiring' | 'hiddenCount' | 'hiddenLayers' | 'activation'>>;
  /** A training script, or none for the built in reward. */
  script?: { source: string; hash: string; customSensors: number };
  onGeneration?: (r: GenerationRecord) => void;
}

/** One sim worker's api in process: the same EpisodeSim the sim worker wraps, called directly. */
function localSim(): Remote<SimApi> {
  const sim = new EpisodeSim();
  const api = {
    evaluate: (...a: Parameters<EpisodeSim['evaluate']>) => sim.evaluate(...a),
    setSpeed: async () => {},
    setPaused: async () => {},
    stopLive: async () => sim.stopLive(),
  };
  // Only the calls a Max run makes are needed; the coordinator never streams here.
  return api as unknown as Remote<SimApi>;
}

/**
 * Trains a Navigation run through the real coordinator and sim code at
 * Max, the way the lab does with no viewport: the coordinator slices the
 * population (seeds and start slots alike) across sims, the trainer breeds
 * and the module moves the curriculum on. Returns every record.
 */
export async function trainThroughPipeline(opts: PipelineRunOptions): Promise<GenerationRecord[]> {
  await loadEpisodeModule('navigation');
  const blueprint = findPresetBlueprint(opts.blueprint ?? 'navigation-standard');
  if (!blueprint || blueprint.env !== 'navigation') throw new Error(`No navigation blueprint ${opts.blueprint}`);
  const config = createEpisodeRunConfig({
    env: 'navigation',
    name: 'pipeline',
    seed: opts.seed,
    blueprint: { ...blueprint, ...opts.brain, ...(opts.neat && { neat: { ...blueprint.neat, ...opts.neat, mutation: { ...blueprint.neat?.mutation, ...opts.neat.mutation } } }) },
    populationSize: opts.population ?? 100,
    settings: { ...navigationSettings(opts.settings) },
    script: opts.script,
  });
  const records: GenerationRecord[] = [];
  let finish: () => void = () => {};
  let fail: (e: Error) => void = () => {};
  const done = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const emit = (e: CoordinatorEvent) => {
    if (e.type === 'generation') {
      records.push(e.record);
      opts.onGeneration?.(e.record);
    } else if (e.type === 'error') fail(new Error(e.message));
    else if (e.type === 'status' && e.status !== 'running') finish();
  };
  const sims = Array.from({ length: opts.workers ?? 2 }, localSim);
  const coordinator = new EpisodeCoordinator(config, sims, emit);
  coordinator.setSpeed('max');
  coordinator.start(opts.generations);
  await done;
  return records;
}

/** One line of a run's log. */
export function describeRecord(r: GenerationRecord): string {
  const m = r.metrics ?? {};
  const pct = (v: number | undefined) => `${Math.round((v ?? 0) * 100)}%`.padStart(4);
  return `gen ${String(r.generation + 1).padStart(3)}  level ${m[NAV_METRIC.level]}  finished ${pct(m[NAV_METRIC.finishShare])}  best fifth ${pct(m[NAV_METRIC.eliteShare])}  died ${pct(m[NAV_METRIC.deathShare])}  best ${r.stats.best.toFixed(1).padStart(5)}  ${Math.round(r.wallMs)} ms`;
}
