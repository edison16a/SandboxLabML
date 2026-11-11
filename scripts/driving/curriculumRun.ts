import { DEFAULT_DRIVING_BLUEPRINT } from '../../src/engine/driving/blueprints';
import { drivingModule } from '../../src/engine/driving/module';
import type { DrivingContent } from '../../src/engine/driving/run/content';
import type { DrivingRunResult } from '../../src/engine/driving/run/results';
import { DEFAULT_DRIVING_SETTINGS, type DrivingSettings } from '../../src/engine/driving/run/settings';
import { loadEpisodeModule } from '../../src/engine/env/registry';
import { EpisodeTrainer } from '../../src/engine/training/episodeTrainer';
import { createEpisodeRunConfig } from '../../src/engine/training/newRun';
import { EpisodeSim } from '../../src/workers/sim/episodeSim';

/** One generation of a headless Driving run, as the log and the tests see it. */
export interface DrivingGeneration {
  generation: number;
  level: number;
  /** The env's generation metrics, as the record stores them. */
  metrics: Record<string, number>;
  bestFitness: number;
  /** Why drives ended, counted over every brain and trip. */
  reasons: Record<string, number>;
  wallMs: number;
  next: DrivingContent;
}

export interface DrivingRunOptions {
  seed: number;
  generations: number;
  population?: number;
  settings?: Partial<DrivingSettings>;
  /** How many sim workers the population is split over, as Turbo and Max do. */
  workers?: number;
  /** Stop early once the curriculum reaches this level. */
  until?: number;
  onGeneration?: (g: DrivingGeneration) => void;
}

/**
 * Trains a Driving run headless through the same code the lab runs: a run
 * config from createEpisodeRunConfig, the EpisodeTrainer the coordinator
 * wraps, and the population split over EpisodeSim instances the way the
 * coordinator splits it over sim workers in Turbo and Max. With no
 * settings this is the lab's default run: the Standard brain, the built in
 * reward and the automatic curriculum. Returns the generation at which
 * each level was first played (index 0 is level 1).
 */
export async function trainDriving(opts: DrivingRunOptions): Promise<number[]> {
  await loadEpisodeModule('driving');
  const config = createEpisodeRunConfig({
    env: 'driving',
    name: 'Headless',
    seed: opts.seed,
    blueprint: DEFAULT_DRIVING_BLUEPRINT,
    populationSize: opts.population ?? 100,
    settings: { ...DEFAULT_DRIVING_SETTINGS, ...opts.settings },
  });
  const trainer = new EpisodeTrainer(drivingModule, config);
  const sims = Array.from({ length: opts.workers ?? 3 }, () => new EpisodeSim());
  const reached = [0];
  for (let k = 0; k < opts.generations; k++) {
    const started = performance.now();
    const setup = trainer.setup();
    const genomes = trainer.genomes;
    const seeds = trainer.seeds();
    const chunk = Math.ceil(genomes.length / sims.length);
    const parts = await Promise.all(sims.map((sim, i) => sim.evaluate('driving', setup, genomes.slice(i * chunk, (i + 1) * chunk), seeds.slice(i * chunk, (i + 1) * chunk), trainer.generation)));
    const results = parts.flat() as DrivingRunResult[];
    const level = trainer.content.level;
    const record = trainer.complete(results, performance.now() - started);
    const reasons: Record<string, number> = {};
    for (const r of results) for (const leg of r.legs) reasons[leg.stopReason ?? 'none'] = (reasons[leg.stopReason ?? 'none'] ?? 0) + 1;
    const next = trainer.content;
    opts.onGeneration?.({ generation: record.generation, level, metrics: record.metrics ?? {}, bestFitness: record.stats.best, reasons, wallMs: record.wallMs, next });
    if (next.level > level && reached[next.level - 1] === undefined) reached[next.level - 1] = record.generation + 1;
    if (opts.until && next.level >= opts.until) break;
  }
  return reached;
}
