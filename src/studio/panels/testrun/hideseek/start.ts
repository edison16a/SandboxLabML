import { blueprintShape } from '@/engine/blueprints/shape';
import type { HideSeekBlueprint } from '@/engine/blueprints/types';
import { mixSeed, Rng } from '@/engine/core/rng';
import type { HideSeekAgent } from '@/engine/hideseek/agents/agent';
import type { HideSeekMatch } from '@/engine/hideseek/match/match';
import { startMatch } from '@/engine/hideseek/match/runMatch';
import type { MatchSpec } from '@/engine/hideseek/match/types';
import type { ArenaPool } from '@/engine/hideseek/world/pool';
import { startTestMatch, type TestMatchScript } from '@/engine/lessons/hideseek/testMatch';
import { createGenome, createTemplate, InnovationTracker, type Genome } from '@/engine/neat';
import type { MatchBrains } from './types';

/** A fresh random genome for the blueprint plus the script's sensors, the way a new run's first generation looks. */
function randomGenome(blueprint: HideSeekBlueprint, sensors: number, seed: number): Genome {
  const tracker = new InnovationTracker();
  return createGenome(createTemplate(blueprintShape(blueprint, sensors), tracker), tracker, new Rng(seed), 0);
}

/**
 * Both teams get their own random brain, seeded from the match seed, and
 * the script's controller runs for each, as in training. The test player
 * match comes from the lessons, so it is the one a lesson check plays.
 */
function startRandomMatch(prepared: TestMatchScript & { blueprint: HideSeekBlueprint }, pool: ArenaPool, seed: number): HideSeekMatch {
  const { script, blueprint, rules } = prepared;
  const sensors = script.sensors.length;
  const spec: MatchSpec = {
    layout: rules.layout,
    seed,
    hider: { genome: randomGenome(blueprint, sensors, mixSeed(seed, 1)), inputs: blueprint.inputs },
    seeker: { genome: randomGenome(blueprint, sensors, mixSeed(seed, 2)), inputs: blueprint.inputs },
  };
  if (rules.prepSeconds !== undefined) spec.prepSeconds = rules.prepSeconds;
  return startMatch(spec, pool, {
    hider: script.createController<HideSeekAgent>({ seed }),
    seeker: script.createController<HideSeekAgent>({ seed }),
  });
}

/** The match a Studio test run plays, ready to step. Same request, same match, so it can be played twice for timing. */
export function startRequestedMatch(prepared: TestMatchScript, brains: MatchBrains, pool: ArenaPool, seed: number): HideSeekMatch {
  const blueprint = prepared.blueprint;
  if (!blueprint) throw new Error('Test matches need a Hide and Seek brain.');
  return brains === 'test' ? startTestMatch(prepared, pool, seed) : startRandomMatch({ ...prepared, blueprint }, pool, seed);
}
