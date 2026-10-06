import { mixSeed, Rng } from '../core/rng';
import { cloneGenome } from '../neat/genome';
import { Population, type PopulationState } from '../neat/population';
import type { Genome } from '../neat/types';
import { buildTrack } from '../racing/track/buildTrack';
import type { RacingResult } from '../racing/episode';
import type { Track, TrackSpec } from '../racing/track/types';
import { racingSetupFor, resolveTrackDirective, type RacingSetup } from './racingSetup';
import type { GenerationRecord } from './records';
import { runShape, scriptAt, type RunConfig } from './runConfig';
import { hostFor, type GenerationContext, type ScriptHost } from './scriptHost';

/** Trainer state that must survive a reload, stored in checkpoints. */
export interface RacingTrainerState {
  population: PopulationState;
  track: TrackSpec;
  bestEver: number;
  stagnation: number;
  scriptRng: [number, number, number, number];
}

/**
 * Racing training without any threads. It hands out the genomes to evaluate,
 * takes the results back, and breeds the next generation. The coordinator
 * worker wraps it, and the reference-results script runs it directly in Node.
 */
export class RacingTrainer {
  readonly config: RunConfig;
  readonly population: Population;
  private trackSpec: TrackSpec;
  private trackObj: Track;
  private bestEver = -Infinity;
  private stagnation = 0;
  private readonly scriptRng: Rng;
  private hostCache: { source: string | null; host: ScriptHost } | null = null;

  constructor(config: RunConfig, state?: RacingTrainerState) {
    if (!config.racing) throw new Error('Not a racing run');
    this.config = config;
    this.population = state
      ? Population.fromState(state.population)
      : Population.create(runShape(config), config.seed, config.neat);
    this.trackSpec = state?.track ?? config.racing.track;
    this.trackObj = buildTrack(this.trackSpec);
    this.bestEver = state?.bestEver ?? -Infinity;
    this.stagnation = state?.stagnation ?? 0;
    this.scriptRng = state ? Rng.fromState(state.scriptRng) : new Rng(mixSeed(config.seed, 0x5c));
  }

  get generation(): number {
    return this.population.generation;
  }

  get track(): Track {
    return this.trackObj;
  }

  get genomes(): Genome[] {
    return this.population.genomes;
  }

  scriptSource(): string | null {
    return scriptAt(this.config, this.generation)?.source ?? null;
  }

  host(): ScriptHost {
    const source = this.scriptSource();
    if (!this.hostCache || this.hostCache.source !== source) this.hostCache = { source, host: hostFor(source) };
    return this.hostCache.host;
  }

  setup(): RacingSetup {
    return racingSetupFor(this.config, this.trackSpec, this.scriptSource());
  }

  /** Per-car seeds for sensor noise and script rand(). Stored on records so replays match. */
  seeds(genomes: Genome[] = this.genomes): number[] {
    return genomes.map((g) => mixSeed(this.config.seed, this.generation, g.id));
  }

  /**
   * Applies evaluated results, runs the script's generation block and breeds
   * the next generation. Returns the record of the generation just finished.
   */
  complete(results: RacingResult[], wallMs: number): GenerationRecord {
    const genomes = this.genomes;
    if (results.length !== genomes.length) throw new Error('Result count does not match the population');
    let bestIndex = 0;
    let simSeconds = 0;
    results.forEach((r, i) => {
      genomes[i].fitness = Number.isFinite(r.fitness) ? r.fitness : 0;
      simSeconds += r.time;
      if (genomes[i].fitness > genomes[bestIndex].fitness) bestIndex = i;
    });
    const champ = genomes[bestIndex];
    const r = results[bestIndex];
    const generation = this.generation;
    const replaySeed = this.seeds([champ])[0];
    const trackHash = this.trackObj.hash;
    const mean = genomes.reduce((s, g) => s + g.fitness, 0) / genomes.length;

    if (champ.fitness > this.bestEver + 1e-9) {
      this.bestEver = champ.fitness;
      this.stagnation = 0;
    } else {
      this.stagnation++;
    }
    const ctx: GenerationContext = {
      generation,
      speciesCount: this.population.species.length,
      bestFitness: champ.fitness,
      meanFitness: mean,
      stagnation: this.stagnation,
    };
    const directives = this.host().runGeneration(ctx, this.scriptRng, this.config.neat);
    const championGenome = cloneGenome(champ);
    const stats = this.population.advance(directives.plan);
    const nextTrack = directives.racing?.track;
    if (nextTrack) {
      this.trackSpec = resolveTrackDirective(nextTrack, this.trackSpec.width);
      this.trackObj = buildTrack(this.trackSpec);
    }
    return {
      runId: this.config.id,
      generation,
      stats,
      champion: {
        genomeId: champ.id,
        fitness: champ.fitness,
        distance: r.distance,
        laps: r.laps,
        bestLapTime: r.bestLapTime,
        crashed: r.crashed,
        crashX: r.crashX,
        crashY: r.crashY,
        stopReason: r.stopReason,
      },
      genome: championGenome,
      trackHash,
      replaySeed,
      simSeconds,
      wallMs,
    };
  }

  toState(): RacingTrainerState {
    return {
      population: this.population.toState(),
      track: this.trackSpec,
      bestEver: this.bestEver,
      stagnation: this.stagnation,
      scriptRng: this.scriptRng.getState(),
    };
  }
}
