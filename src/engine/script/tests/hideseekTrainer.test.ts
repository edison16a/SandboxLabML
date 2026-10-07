import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findPresetBlueprint } from '../../blueprints/presets';
import { createArenaPool, HideSeekTrainer, type ArenaPool, type HideSeekGenerationScript, type HideSeekInputConfig, type HideSeekTrainerOptions } from '../../hideseek';
import { builtinHost } from '../../training/scriptHost';
import { hideSeekPhysics } from '../../hideseek/physics';
import { createScriptHost, type ScriptHostAdapter } from '../host';
import { findScriptPreset } from '../presets/racing';
import { HIDESEEK_ACT } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** A small run driven by a script: its sensors size the brains and it decides the rules. */
function scriptedRun(host: ScriptHostAdapter, brain: string, over: Partial<HideSeekTrainerOptions> = {}): HideSeekTrainer {
  const inputs = findPresetBlueprint(brain)!.inputs as HideSeekInputConfig;
  const custom = host.customSensors.length;
  const options = { seed: 3, hiderInputs: inputs, seekerInputs: inputs, populationSize: 4, hiderCustomSensors: custom, seekerCustomSensors: custom, ...over };
  return HideSeekTrainer.create(options, host);
}

const generationOnly = (block: string) => `script "g" for hideseek v1\n\neach tick {\n  ${HIDESEEK_ACT}\n}\n\neach generation {\n${block}\n}\n`;

describe('scripts in the trainer', () => {
  it('runs the Advanced preset end to end for a few generations', () => {
    const host = createScriptHost(findScriptPreset('hideseek-advanced')!.source);
    const trainer = scriptedRun(host, 'hideseek-advanced');
    // The generation block also ran before generation 0, so its rules hold from the start.
    expect(trainer.options.prepSeconds).toBe(12);
    expect(trainer.options.opponents).toEqual({ current: 2, hallOfFame: 0, scripted: 2 });
    expect([trainer.options.mixLayouts, trainer.options.sharedSeeds]).toEqual([true, false]);
    expect(trainer.options.layouts).toEqual(['open', 'shelter', 'corridor']);
    for (let g = 0; g < 3; g++) {
      const stats = trainer.runGeneration(pool, (spec) => host.createHideSeekControllers(spec.seed), host);
      for (const v of [stats.hiders.best, stats.hiders.mean, stats.seekers.best, stats.seekers.mean]) expect(Number.isFinite(v)).toBe(true);
      expect(stats.game.scriptedHiddenShare).toBeGreaterThanOrEqual(0);
    }
    expect(trainer.history).toHaveLength(3);
    expect(trainer.planGeneration().flat().every((s) => s.prepSeconds === 12)).toBe(true);
  });

  it('applies a directive from the generation block to the next generation', () => {
    const host = createScriptHost(generationOnly('  if generation >= 1 {\n    prepTime(length: 2 s)\n    opponents(current: 1, scripted: 1)\n  }'));
    const trainer = scriptedRun(host, 'hideseek-starter', { physics: hideSeekPhysics({ matchSeconds: 5 }) });
    expect(trainer.options.prepSeconds).toBeUndefined();
    const play = () => trainer.runGeneration(pool, (spec) => host.createHideSeekControllers(spec.seed), host);
    play();
    expect(trainer.planGeneration().map((r) => r.length)).toEqual([4, 4, 8, 8]);
    play();
    const plan = trainer.planGeneration();
    expect(plan.map((r) => r.length)).toEqual([4, 8]);
    expect(plan.flat().every((s) => s.prepSeconds === 2)).toBe(true);
  });

  it('accepts the training layer script hosts as they are', () => {
    // Type level: both ScriptHost implementations fit the trainer's generation script hook.
    const hooks: HideSeekGenerationScript[] = [builtinHost, createScriptHost(findScriptPreset('hideseek-beginner')!.source)];
    const trainer = scriptedRun(createScriptHost(generationOnly('  useLayout(id: "corridor")')), 'hideseek-starter', { physics: hideSeekPhysics({ matchSeconds: 3 }) });
    expect(() => trainer.runGeneration(pool, {}, hooks[0])).not.toThrow();
    expect(trainer.options.layouts).toEqual(['corridor']);
  });

  it('breeds each team with the plan its pass of the block asked for', () => {
    const host = createScriptHost(generationOnly('  select(top: 50%)\n  speciate(target: 2)\n  breed(crossover: 0.75)\n  keepChampions()'));
    const trainer = scriptedRun(host, 'hideseek-starter', { physics: hideSeekPhysics({ matchSeconds: 3 }), populationSize: 8 });
    const seen: number[] = [];
    const spy = { runGeneration: (...args: Parameters<typeof host.runGeneration>) => (seen.push(args[0].generation), host.runGeneration(...args)) };
    trainer.runGeneration(pool, {}, spy);
    // Once per team after generation 0.
    expect(seen).toEqual([0, 0]);
  });

  it('gives script sensors to both brains', () => {
    const host = createScriptHost(
      `script "s" for hideseek v1\nsensor near "Opponent near" in 0 m .. 20 m = agent.opponentDistance\n\neach tick {\n  ${HIDESEEK_ACT}\n  reward +1 * dt when agent.isHider and agent.hidden\n}\n`,
    );
    const trainer = scriptedRun(host, 'hideseek-starter', { physics: hideSeekPhysics({ matchSeconds: 3 }) });
    // Starter has 17 built-in inputs; the sensor adds one for each team.
    expect([trainer.hiders.genomes[0].inputs.length, trainer.seekers.genomes[0].inputs.length]).toEqual([18, 18]);
    expect(() => trainer.runGeneration(pool, (spec) => host.createHideSeekControllers(spec.seed), host)).not.toThrow();
  });
});
