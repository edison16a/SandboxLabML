import { mixSeed, Rng } from '../../core/rng';
import type { NeatConfig } from '../../neat/config';
import type { GenerationPlan } from '../../neat/plan';
import type { Population } from '../../neat/population';
import { readHideSeekDirective } from './directive';
import type { HideSeekDirective, HideSeekGenerationStats } from './types';

/**
 * Facts about the generation that just finished, for one team. Same shape
 * as the script language's GenerationContext, so a compiled script's
 * generation block can read it directly.
 */
export interface TeamGenerationContext {
  generation: number;
  speciesCount: number;
  bestFitness: number;
  meanFitness: number;
  /** Generations since this team's best fitness last went up. */
  stagnation: number;
}

/**
 * Whatever decides breeding and match rules after a generation, usually a
 * script's each generation block. ScriptHost.runGeneration already has
 * this shape, so a script host can be passed as it is.
 */
export interface HideSeekGenerationScript {
  runGeneration(ctx: TeamGenerationContext, rng: Rng, neat: NeatConfig): { plan: GenerationPlan; hideseek?: unknown };
}

/** What the generation block decided for both teams. */
export interface GenerationDecision {
  plans: { hiders: GenerationPlan; seekers: GenerationPlan };
  directive: HideSeekDirective;
}

/** Generations since `best` was last beaten, counting the generation that just finished. */
function stagnation(history: HideSeekGenerationStats[], team: 'hiders' | 'seekers', best: number): number {
  let record = -Infinity;
  let since = 0;
  for (const h of [...history.map((s) => s[team].best), best]) {
    if (h > record + 1e-9) {
      record = h;
      since = 0;
    } else {
      since++;
    }
  }
  return since;
}

function contextFor(pop: Population, generation: number, history: HideSeekGenerationStats[], team: 'hiders' | 'seekers'): TeamGenerationContext {
  const fits = pop.genomes.map((g) => g.fitness);
  const best = Math.max(...fits);
  const mean = fits.reduce((a, b) => a + b, 0) / Math.max(1, fits.length);
  return { generation, speciesCount: pop.species.length, bestFitness: best, meanFitness: mean, stagnation: stagnation(history, team, best) };
}

type Teams = { hiders: Population; seekers: Population };

/**
 * Runs the generation block once per team, hiders first, each with that
 * team's numbers and its own NEAT settings. Match rules are shared, so the
 * two passes' directives are merged, the seekers' pass winning where they
 * disagree. `rand()` draws from an Rng seeded by the run, the salt, the
 * generation and the team, so a resumed run decides the same way without
 * storing any Rng state.
 */
function bothTeams(
  script: HideSeekGenerationScript,
  seed: number,
  salt: number,
  teams: Teams,
  context: (team: 'hiders' | 'seekers') => TeamGenerationContext,
): GenerationDecision {
  const pass = (team: 'hiders' | 'seekers', k: number) => {
    const ctx = context(team);
    return script.runGeneration(ctx, new Rng(mixSeed(seed, salt, ctx.generation, k)), teams[team].config);
  };
  const h = pass('hiders', 0);
  const s = pass('seekers', 1);
  const directive = { ...readHideSeekDirective(h.hideseek), ...readHideSeekDirective(s.hideseek) };
  return { plans: { hiders: h.plan, seekers: s.plan }, directive };
}

/** The decision after a scored generation: each pass shapes its team's breeding plan and the next match rules. */
export function decideGeneration(
  script: HideSeekGenerationScript,
  seed: number,
  generation: number,
  teams: Teams,
  history: HideSeekGenerationStats[],
): GenerationDecision {
  return bothTeams(script, seed, 0x5c71, teams, (team) => contextFor(teams[team], generation, history, team));
}

/**
 * Match rules for generation 0. The block normally runs after a generation,
 * so without this a script's rooms or prep time would only start from
 * generation 1. It runs with generation 0 and zero fitness, and only its
 * match rules are kept.
 */
export function firstRules(script: HideSeekGenerationScript, seed: number, teams: Teams): HideSeekDirective {
  const zero = (team: 'hiders' | 'seekers'): TeamGenerationContext => ({
    generation: 0,
    speciesCount: teams[team].species.length,
    bestFitness: 0,
    meanFitness: 0,
    stagnation: 0,
  });
  return bothTeams(script, seed, 0x5c72, teams, zero).directive;
}
