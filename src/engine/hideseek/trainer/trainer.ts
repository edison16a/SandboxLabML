import { mixSeed, Rng, type RngState } from '../../core/rng';
import type { GenerationPlan } from '../../neat/plan';
import { defaultPlan, Population } from '../../neat/population';
import type { GenomeShape } from '../../neat/types';
import { HIDESEEK_OUTPUT_COUNT, type HideSeekInputConfig } from '../inputConfig';
import { HIDESEEK_LAYOUT_IDS } from '../layouts/presets';
import { runMatch } from '../match/runMatch';
import type { MatchControllers, MatchResult, MatchSpec } from '../match/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '../physics';
import { hideSeekBrainInputs } from '../sensing/inputSchema';
import type { ArenaPool } from '../world/pool';
import { HallOfFame } from './hallOfFame';
import { planRounds } from './schedule';
import { scoreGeneration } from './scoring';
import type { HideSeekGenerationStats, HideSeekTrainerOptions, HideSeekTrainerState, ResolvedTrainerOptions } from './types';

/** Fills in every default, so the stored options fully describe the run. */
export function resolveTrainerOptions(o: HideSeekTrainerOptions): ResolvedTrainerOptions {
  const rounds = Math.round(o.rounds ?? 4);
  if (rounds < 1 || rounds > 4) throw new Error('A generation has 1 to 4 rounds.');
  return {
    ...o,
    populationSize: o.populationSize ?? 50,
    activation: o.activation ?? 'tanh',
    wiring: o.wiring ?? 'direct',
    hiderCustomSensors: o.hiderCustomSensors ?? 0,
    seekerCustomSensors: o.seekerCustomSensors ?? 0,
    layouts: o.layouts?.length ? [...o.layouts] : [...HIDESEEK_LAYOUT_IDS],
    rounds,
    hallOfFameSize: o.hallOfFameSize ?? 20,
    reward: o.reward ?? 'v1',
    physics: o.physics ?? DEFAULT_HIDESEEK_PHYSICS,
  };
}

function shapeFor(o: ResolvedTrainerOptions, inputs: HideSeekInputConfig, custom: number): GenomeShape {
  return {
    inputCount: hideSeekBrainInputs(inputs, custom),
    outputCount: HIDESEEK_OUTPUT_COUNT,
    activation: o.activation,
    wiring: o.wiring,
    hiddenCount: o.hiddenCount,
  };
}

/**
 * Co-evolves hiders and seekers: two NEAT populations, a hall of fame of
 * past champions per team, and the generation loop. It only orchestrates,
 * so matches can run anywhere: call `planGeneration`, play every spec with
 * `runMatch` (in workers, in any order), then pass the results, shaped like
 * the plan, to `completeGeneration`. `runGeneration` does all three in this
 * thread.
 */
export class HideSeekTrainer {
  readonly options: ResolvedTrainerOptions;
  readonly hiders: Population;
  readonly seekers: Population;
  readonly hallOfFame: { hiders: HallOfFame; seekers: HallOfFame };
  readonly history: HideSeekGenerationStats[];
  private readonly rng: Rng;
  private pending: MatchSpec[][] | null = null;
  /** Run Rng state from before the pending plan, so a checkpoint taken mid generation replans the same way. */
  private rngBeforePlan: RngState | null = null;

  private constructor(state: Omit<HideSeekTrainerState, 'version' | 'hiders' | 'seekers'> & { hiders: Population; seekers: Population }) {
    this.options = state.options;
    this.hiders = state.hiders;
    this.seekers = state.seekers;
    const size = state.options.hallOfFameSize;
    this.hallOfFame = { hiders: new HallOfFame(size, state.hallOfFame.hiders), seekers: new HallOfFame(size, state.hallOfFame.seekers) };
    this.rng = Rng.fromState(state.rng);
    this.history = state.history.map((h) => structuredClone(h));
  }

  static create(options: HideSeekTrainerOptions): HideSeekTrainer {
    const o = resolveTrainerOptions(options);
    const neat = (overrides: HideSeekTrainerOptions['hiderNeat']) => ({ populationSize: o.populationSize, ...overrides });
    const hiders = Population.create(shapeFor(o, o.hiderInputs, o.hiderCustomSensors), mixSeed(o.seed, 1), neat(o.hiderNeat));
    const seekers = Population.create(shapeFor(o, o.seekerInputs, o.seekerCustomSensors), mixSeed(o.seed, 2), neat(o.seekerNeat));
    const rng = new Rng(mixSeed(o.seed, 3)).getState();
    return new HideSeekTrainer({ options: o, hiders, seekers, hallOfFame: { hiders: [], seekers: [] }, rng, history: [] });
  }

  static fromState(s: HideSeekTrainerState): HideSeekTrainer {
    return new HideSeekTrainer({ ...s, hiders: Population.fromState(s.hiders), seekers: Population.fromState(s.seekers) });
  }

  /** A checkpoint. Taken mid generation, it resumes by replanning that generation identically. */
  toState(): HideSeekTrainerState {
    return {
      version: 1,
      options: structuredClone(this.options),
      hiders: this.hiders.toState(),
      seekers: this.seekers.toState(),
      hallOfFame: { hiders: this.hallOfFame.hiders.toState(), seekers: this.hallOfFame.seekers.toState() },
      rng: this.rngBeforePlan ?? this.rng.getState(),
      history: this.history.map((h) => structuredClone(h)),
    };
  }

  /** The generation being evaluated (0 based). */
  get generation(): number {
    return this.hiders.generation;
  }

  /** Rounds of match specs for the current generation. Calling it again before completing returns the same plan. */
  planGeneration(): MatchSpec[][] {
    if (this.pending) return this.pending;
    this.rngBeforePlan = this.rng.getState();
    this.pending = planRounds({
      options: this.options,
      generation: this.generation,
      hiders: this.hiders.genomes,
      seekers: this.seekers.genomes,
      hallOfFame: this.hallOfFame,
      rng: this.rng,
    });
    return this.pending;
  }

  /**
   * Scores the planned generation from its results (same shape as the
   * plan), adds each team's champion to its hall of fame, then breeds both
   * populations with a plan per team. Returns the generation's stats.
   */
  completeGeneration(results: MatchResult[][], plans: { hiders?: GenerationPlan; seekers?: GenerationPlan } = {}): HideSeekGenerationStats {
    if (!this.pending) throw new Error('Call planGeneration before completeGeneration.');
    const scores = scoreGeneration(this.pending, results, this.hiders.genomes.length, this.seekers.genomes.length);
    this.hiders.genomes.forEach((g, i) => (g.fitness = scores.hiderFitness[i]));
    this.seekers.genomes.forEach((g, i) => (g.fitness = scores.seekerFitness[i]));
    const generation = this.generation;
    this.hallOfFame.hiders.add(this.hiders.champion(), generation);
    this.hallOfFame.seekers.add(this.seekers.champion(), generation);
    const hiders = this.hiders.advance(plans.hiders ?? defaultPlan(this.hiders.config));
    const seekers = this.seekers.advance(plans.seekers ?? defaultPlan(this.seekers.config));
    const hallOfFame = { hiders: this.hallOfFame.hiders.size, seekers: this.hallOfFame.seekers.size };
    const stats: HideSeekGenerationStats = { generation, hiders, seekers, game: { ...scores.game, hallOfFame } };
    this.history.push(stats);
    this.pending = null;
    this.rngBeforePlan = null;
    return stats;
  }

  /** Plans, plays every match in this thread and completes one generation. */
  runGeneration(pool: ArenaPool, controllers: MatchControllers = {}): HideSeekGenerationStats {
    const plan = this.planGeneration();
    return this.completeGeneration(plan.map((round) => round.map((spec) => runMatch(spec, pool, controllers))));
  }
}
