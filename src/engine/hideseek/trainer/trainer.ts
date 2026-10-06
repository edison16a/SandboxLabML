import { mixSeed, Rng, type RngState } from '../../core/rng';
import type { GenerationPlan } from '../../neat/plan';
import { defaultPlan, Population } from '../../neat/population';
import type { GenomeShape } from '../../neat/types';
import { HIDESEEK_OUTPUT_COUNT, type HideSeekInputConfig } from '../inputConfig';
import { runMatch } from '../match/runMatch';
import type { MatchControllers, MatchResult, MatchSpec } from '../match/types';
import { hideSeekBrainInputs } from '../sensing/inputSchema';
import type { ArenaPool } from '../world/pool';
import { applyHideSeekDirective, readHideSeekDirective } from './directive';
import { decideGeneration, firstRules, type HideSeekGenerationScript } from './generationScript';
import { HallOfFame } from './hallOfFame';
import { planRounds } from './schedule';
import { scoreGeneration } from './scoring';
import { resolveTrainerOptions, upgradeStoredOptions } from './setups';
import type { HideSeekDirective, HideSeekGenerationStats, HideSeekTrainerOptions, HideSeekTrainerState, ResolvedTrainerOptions } from './types';

export { resolveTrainerOptions };

/** Breeding plans for one generation, per team. A team left out breeds with its default plan. */
export type TeamPlans = { hiders?: GenerationPlan; seekers?: GenerationPlan };

/** Script controllers for a match, fixed for every match or chosen per spec (a script builds them from the match seed). */
export type ControllersFor = MatchControllers | ((spec: MatchSpec) => MatchControllers);

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
  /** The live rules. Directives change them between generations; checkpoints store them. */
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
    this.options = upgradeStoredOptions(state.options);
    this.hiders = state.hiders;
    this.seekers = state.seekers;
    const size = this.options.hallOfFameSize;
    this.hallOfFame = { hiders: new HallOfFame(size, state.hallOfFame.hiders), seekers: new HallOfFame(size, state.hallOfFame.seekers) };
    this.rng = Rng.fromState(state.rng);
    this.history = state.history.map((h) => structuredClone(h));
  }

  /**
   * A new run. With a `script`, its generation block also runs once up
   * front so its match rules (rooms, prep time, opponents) hold from
   * generation 0, not only from generation 1.
   */
  static create(options: HideSeekTrainerOptions, script?: HideSeekGenerationScript): HideSeekTrainer {
    const o = resolveTrainerOptions(options);
    const neat = (overrides: HideSeekTrainerOptions['hiderNeat']) => ({ populationSize: o.populationSize, ...overrides });
    const hiders = Population.create(shapeFor(o, o.hiderInputs, o.hiderCustomSensors), mixSeed(o.seed, 1), neat(o.hiderNeat));
    const seekers = Population.create(shapeFor(o, o.seekerInputs, o.seekerCustomSensors), mixSeed(o.seed, 2), neat(o.seekerNeat));
    const rng = new Rng(mixSeed(o.seed, 3)).getState();
    const trainer = new HideSeekTrainer({ options: o, hiders, seekers, hallOfFame: { hiders: [], seekers: [] }, rng, history: [] });
    if (script) trainer.applyDirective(firstRules(script, o.seed, trainer));
    return trainer;
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
   * Changes match rules (opponent mix, prep time, rooms, hall of fame
   * size). They apply from the next generation that is not planned yet:
   * a pending plan is never changed under the workers playing it.
   */
  applyDirective(directive: HideSeekDirective): void {
    const d = readHideSeekDirective(directive);
    applyHideSeekDirective(this.options, d);
    if (d.hallOfFameSize !== undefined) {
      this.hallOfFame.hiders.resize(d.hallOfFameSize);
      this.hallOfFame.seekers.resize(d.hallOfFameSize);
    }
  }

  /**
   * Scores the planned generation from its results (same shape as the
   * plan), adds each team's champion to its hall of fame, then breeds both
   * populations with a plan per team. With a `script`, its generation block
   * runs once per team after scoring: its plans are used for any team
   * `plans` leaves out, and its match rules apply to the next generation.
   * Returns the generation's stats.
   */
  completeGeneration(results: MatchResult[][], plans: TeamPlans = {}, script?: HideSeekGenerationScript): HideSeekGenerationStats {
    if (!this.pending) throw new Error('Call planGeneration before completeGeneration.');
    const scores = scoreGeneration(this.pending, results, this.hiders.genomes.length, this.seekers.genomes.length);
    this.hiders.genomes.forEach((g, i) => (g.fitness = scores.hiderFitness[i]));
    this.seekers.genomes.forEach((g, i) => (g.fitness = scores.seekerFitness[i]));
    const generation = this.generation;
    const decision = script ? decideGeneration(script, this.options.seed, generation, this, this.history) : null;
    this.hallOfFame.hiders.add(this.hiders.champion(), generation);
    this.hallOfFame.seekers.add(this.seekers.champion(), generation);
    const hiders = this.hiders.advance(plans.hiders ?? decision?.plans.hiders ?? defaultPlan(this.hiders.config));
    const seekers = this.seekers.advance(plans.seekers ?? decision?.plans.seekers ?? defaultPlan(this.seekers.config));
    const hallOfFame = { hiders: this.hallOfFame.hiders.size, seekers: this.hallOfFame.seekers.size };
    const stats: HideSeekGenerationStats = { generation, hiders, seekers, game: { ...scores.game, hallOfFame } };
    this.history.push(stats);
    this.pending = null;
    this.rngBeforePlan = null;
    if (decision) this.applyDirective(decision.directive);
    return stats;
  }

  /** Plans, plays every match in this thread and completes one generation. */
  runGeneration(pool: ArenaPool, controllers: ControllersFor = {}, script?: HideSeekGenerationScript): HideSeekGenerationStats {
    const plan = this.planGeneration();
    const pick = typeof controllers === 'function' ? controllers : () => controllers;
    return this.completeGeneration(
      plan.map((round) => round.map((spec) => runMatch(spec, pool, pick(spec)))),
      {},
      script,
    );
  }
}
