import { Rng } from '../../core/rng';
import type { HideSeekLayoutId } from '../../hideseek/layouts/types';
import { readHideSeekDirective } from '../../hideseek/trainer/directive';
import type { CompiledScript } from '../../script/compiler';

/**
 * Seed of every lesson test match: where the players start and how the
 * boxes are jittered. Kept here, away from the match code, so the Studio
 * can name it without loading the physics engine.
 */
export const TEST_MATCH_SEED = 12;

/** The room a test match plays when the script names none: the first room a new run plays. */
export const DEFAULT_TEST_LAYOUT: HideSeekLayoutId = 'open';

/** Where and how a script's first matches are played, as its generation block sets them. */
export interface FirstMatchRules {
  layout: HideSeekLayoutId;
  /** Prep phase length, s, or undefined for the usual 9 seconds. */
  prepSeconds?: number;
}

/**
 * Lessons carry no room of their own. A script picks rooms and prep time
 * in its generation block, and the trainer runs that block once before
 * generation 0 so its rules hold from the start. A test match does the
 * same and plays the first room the script asks for, so it shows the
 * match the first round of training would play.
 */
export function firstMatchRules(script: CompiledScript): FirstMatchRules {
  try {
    const ctx = { generation: 0, speciesCount: 1, bestFitness: 0, meanFitness: 0, stagnation: 0 };
    const d = readHideSeekDirective(script.runGeneration(ctx, new Rng(1)).hideseek);
    const rules: FirstMatchRules = { layout: d.layouts?.[0] ?? DEFAULT_TEST_LAYOUT };
    if (d.prepSeconds !== undefined) rules.prepSeconds = d.prepSeconds;
    return rules;
  } catch {
    return { layout: DEFAULT_TEST_LAYOUT };
  }
}
