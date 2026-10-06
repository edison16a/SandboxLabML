import { Rng } from '../../core/rng';
import { makeTickIO } from '../../env/types';
import type { NeatConfig } from '../../neat/config';
import { defaultPlan } from '../../neat/population';
import type { CheckResult } from '../check/context';
import type { GenerationContext, GenerationDirectives, GenerationView } from '../generationTypes';
import type { RngHolder } from '../registry/types';
import { eachBlock } from '../walk';
import type { Frame } from './frame';
import { compileBlock } from './stmt';

export type GenerationRunner = (ctx: GenerationContext, rng: Rng, neat: NeatConfig) => GenerationDirectives;

/**
 * Compiles the `each generation` block once. Each run starts from the
 * default plan for the run's NEAT config, so an operator the script does
 * not call keeps its default, and then lets the operators overwrite parts.
 * `rand()` here draws from the Rng the coordinator passes in.
 */
export function buildGeneration(check: CheckResult): GenerationRunner {
  const holder: RngHolder = { rng: new Rng(0) };
  const slots = new Float64Array(Math.max(1, check.slotCount.generation));
  const f: Frame = { check, bind: { controller: { seed: 0 }, rng: holder }, slots };
  const block = eachBlock(check.program, 'generation');
  const run = block ? compileBlock(f, block) : null;
  const io = makeTickIO(0, 0);
  return (ctx, rng, neat) => {
    const plan = defaultPlan(neat);
    const view: GenerationView = { ctx, directives: { plan: { ...plan, mutation: { ...plan.mutation } } } };
    holder.rng = rng;
    slots.fill(0);
    if (run) run(view, io);
    return view.directives;
  };
}
