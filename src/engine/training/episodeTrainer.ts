import { mixSeed, Rng } from '../core/rng';
import type { EpisodeEnvModule, EpisodeResult, EpisodeSetup } from '../env/episode';
import { cloneGenome } from '../neat/genome';
import { Population, type PopulationState } from '../neat/population';
import type { Genome } from '../neat/types';
import type { ChampionRecord, GenerationRecord } from './records';
import { runShape, scriptAt, type RunConfig } from './runConfig';
import { hostFor, type GenerationContext, type ScriptHost } from './scriptHost';

/** Trainer state that must survive a reload, stored in checkpoints. */
export interface EpisodeTrainerState<Content = unknown> {
  population: PopulationState;
  /** What the population trains on now (see EpisodeEnvModule). */
  content: Content;
  bestEver: number;
  stagnation: number;
  scriptRng: [number, number, number, number];
}

/** Checkpoints saved before the generic trainer kept Racing's track under `track`. */
type StoredState<Content> = Omit<EpisodeTrainerState<Content>, 'content'> & { content?: Content; track?: Content };

/** Seed of the generation block's random stream, mixed from the run seed. */
const SCRIPT_RNG_SALT = 0x5c;
/** Mixed into the seed of each generation's start slots. */
const SLOT_SALT = 0x51a7;

/** The seed of a generation's start slots (see EpisodeEnvModule.startSlots), so a lab can line agents up as training will. */
export function startSlotSeed(runSeed: number, generation: number): number {
  return mixSeed(runSeed, generation, SLOT_SALT);
}

/**
 * Seed of the script controller for a training episode of `generation`.
 * Workers, lessons and tests all use it, so an episode run anywhere draws
 * the same numbers. Script rand() in a tick then mixes in each agent's seed.
 */
export function trainingControllerSeed(generation: number): number {
  return mixSeed(generation, 0x51);
}

/**
 * Single population training without any threads, for any episode env. It
 * hands out the genomes to evaluate, takes the results back, runs the
 * script's generation block, breeds the next generation and moves the
 * env's content on. The coordinator worker wraps it; lessons, tests and the
 * reference scripts run it directly.
 */
export class EpisodeTrainer<Setup extends EpisodeSetup = EpisodeSetup, Content = unknown, R extends EpisodeResult = EpisodeResult, C extends ChampionRecord = ChampionRecord> {
  readonly config: RunConfig;
  readonly population: Population;
  readonly module: EpisodeEnvModule<Setup, Content, R, C>;
  private contentNow: Content;
  private bestEver = -Infinity;
  private stagnation = 0;
  private readonly scriptRng: Rng;
  private hostCache: { source: string | null; host: ScriptHost } | null = null;

  constructor(module: EpisodeEnvModule<Setup, Content, R, C>, config: RunConfig, state?: EpisodeTrainerState<Content>) {
    if (config.env !== module.id) throw new Error(`This is a ${config.env} run, not ${module.id}.`);
    this.module = module;
    this.config = config;
    const stored = state as StoredState<Content> | undefined;
    this.population = stored ? Population.fromState(stored.population) : Population.create(runShape(config), config.seed, config.neat);
    this.contentNow = stored?.content ?? stored?.track ?? module.initialContent(config);
    this.bestEver = stored?.bestEver ?? -Infinity;
    this.stagnation = stored?.stagnation ?? 0;
    this.scriptRng = stored ? Rng.fromState(stored.scriptRng) : new Rng(mixSeed(config.seed, SCRIPT_RNG_SALT));
  }

  get generation(): number {
    return this.population.generation;
  }

  get genomes(): Genome[] {
    return this.population.genomes;
  }

  /** What the population trains on now. A new object whenever it changed, so callers can compare references. */
  get content(): Content {
    return this.contentNow;
  }

  scriptSource(): string | null {
    return scriptAt(this.config, this.generation)?.source ?? null;
  }

  host(): ScriptHost {
    const source = this.scriptSource();
    if (!this.hostCache || this.hostCache.source !== source) this.hostCache = { source, host: hostFor(source) };
    return this.hostCache.host;
  }

  /** Everything a worker needs to run this generation, as plain data. */
  setup(): Setup {
    return this.module.createSetup({ config: this.config, content: this.contentNow, scriptSource: this.scriptSource() });
  }

  /** Per agent seeds for noise and script rand(). Stored on records so replays match. */
  seeds(genomes: Genome[] = this.genomes): number[] {
    return genomes.map((g) => mixSeed(this.config.seed, this.generation, g.id));
  }

  /**
   * Start slots of this generation, agent i taking slot i, or undefined for
   * an env that hands none out. Seeded by the run and the generation, so
   * every worker and every replay agrees.
   */
  slots(): number[] | undefined {
    return this.module.startSlots?.(this.genomes.length, startSlotSeed(this.config.seed, this.generation));
  }

  /**
   * Applies evaluated results, runs the script's generation block, breeds
   * the next generation and moves the content on. Returns the record of the
   * generation just finished.
   */
  complete(results: R[], wallMs: number): GenerationRecord<C> {
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
    const replaySlot = this.slots()?.[bestIndex];
    const ranOn = this.contentNow;
    const trackHash = this.module.contentHash(ranOn);
    const mean = genomes.reduce((s, g) => s + g.fitness, 0) / genomes.length;
    const metrics = this.module.generationMetrics?.(results, this.contentNow);

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
      ...(metrics && { metrics }),
    };
    const directives = this.host().runGeneration(ctx, this.scriptRng, this.config.neat);
    const championGenome = cloneGenome(champ);
    const stats = this.population.advance(directives.plan);
    const next = this.module.nextContent({ config: this.config, content: this.contentNow, generation, directives, results, metrics: metrics ?? {} });
    if (next) {
      this.contentNow = next.content;
      if (next.reset) {
        // Scores on the new content are not comparable with the old ones.
        this.population.resetStagnation();
        this.bestEver = -Infinity;
        this.stagnation = 0;
      }
    }
    const champion = { genomeId: champ.id, fitness: champ.fitness, ...this.module.championFields(r), stopReason: r.stopReason } as C;
    const record: GenerationRecord<C> = { runId: this.config.id, generation, stats, champion, genome: championGenome, trackHash, replaySeed, simSeconds, wallMs, ...(metrics && { metrics }) };
    // The content this generation ran on, read before nextContent replaced it.
    if (this.module.contentOnRecords) record.content = ranOn;
    if (replaySlot !== undefined) record.replaySlot = replaySlot;
    return record;
  }

  toState(): EpisodeTrainerState<Content> {
    return {
      population: this.population.toState(),
      content: this.contentNow,
      bestEver: this.bestEver,
      stagnation: this.stagnation,
      scriptRng: this.scriptRng.getState(),
    };
  }
}
