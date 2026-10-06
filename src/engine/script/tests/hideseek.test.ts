import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findPresetBlueprint } from '../../blueprints/presets';
import { Rng } from '../../core/rng';
import { createArenaPool, runMatch, type ArenaPool, type HideSeekInputConfig, type HideSeekRewardId, type MatchSpec } from '../../hideseek';
import { hideSeekInputCount } from '../../hideseek/inputConfig';
import { DEFAULT_NEAT } from '../../neat/config';
import { Population } from '../../neat/population';
import { blockPalette, fromBlocks, toBlocks } from '../blocks';
import { createScriptHost } from '../host';
import { parse } from '../parser';
import { findScriptPreset } from '../presets/racing';
import { print } from '../printer';
import { errors, HIDESEEK_ACT, inHideSeekGeneration, inHideSeekTick } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

const source = (id: string) => findScriptPreset(id)!.source;
const inputsOf = (id: string) => findPresetBlueprint(id)!.inputs as HideSeekInputConfig;

/** Full length matches in every room between random brains, as plain specs. */
function specs(inputs: HideSeekInputConfig, count: number, reward: HideSeekRewardId): MatchSpec[] {
  const shape = { inputCount: hideSeekInputCount(inputs), outputCount: 4, activation: 'tanh' as const, wiring: 'direct' as const };
  const genomes = Population.create(shape, 31, { populationSize: count * 2 }).genomes;
  return Array.from({ length: count }, (_, i) => ({
    layout: (['open', 'shelter', 'corridor'] as const)[i % 3],
    seed: 4000 + i,
    hider: { genome: genomes[i], inputs },
    seeker: { genome: genomes[count + i], inputs },
    reward,
  }));
}

describe('hide and seek presets', () => {
  it('Intermediate plays every match exactly like the built-in v1 rewards', () => {
    const host = createScriptHost(source('hideseek-intermediate'));
    for (const spec of specs(inputsOf('hideseek-standard'), 6, 'v1')) {
      expect(runMatch(spec, pool, host.createHideSeekControllers(spec.seed)), spec.layout).toEqual(runMatch(spec, pool));
    }
  });

  it('Beginner plays every match exactly like the built-in Starter rewards', () => {
    const host = createScriptHost(source('hideseek-beginner'));
    for (const spec of specs(inputsOf('hideseek-starter'), 3, 'starter')) {
      expect(runMatch(spec, pool, host.createHideSeekControllers(spec.seed))).toEqual(runMatch(spec, pool));
    }
  });

  it('their generation blocks set the match rules', () => {
    const run = (id: string, generation: number) =>
      createScriptHost(source(id)).runGeneration({ generation, speciesCount: 8, bestFitness: 1, meanFitness: 0, stagnation: 0 }, new Rng(1), DEFAULT_NEAT).hideseek;
    expect(run('hideseek-beginner', 0)).toEqual({ layouts: ['open'] });
    expect(run('hideseek-intermediate', 0)).toEqual({
      opponents: { current: 2, hallOfFame: 2, scripted: 0 },
      hallOfFameSize: 20,
      layouts: ['open', 'shelter'],
      mixLayouts: false,
      sharedSeeds: false,
    });
    const advanced = [0, 15, 40].map((g) => run('hideseek-advanced', g));
    expect(advanced.map((d) => d?.prepSeconds)).toEqual([12, 10.5, 9]);
    expect(advanced.map((d) => d?.opponents)).toEqual([0, 15, 40].map((g) => (g < 30 ? { current: 2, hallOfFame: 0, scripted: 2 } : { current: 2, hallOfFame: 1, scripted: 1 })));
    expect([advanced[0]?.mixLayouts, advanced[0]?.sharedSeeds]).toEqual([true, true]);
    expect(advanced[0]?.layouts).toEqual(['open', 'shelter', 'corridor']);
  });
});

describe('hide and seek scripts', () => {
  it('give both teams the script sensors', () => {
    const host = createScriptHost(`script "s" for hideseek v1\nsensor near "Opponent near" in 0 m .. 20 m = agent.opponentDistance\n\neach tick {\n  ${HIDESEEK_ACT}\n}\n`);
    const { hider, seeker } = host.createHideSeekControllers(1);
    expect([hider.customSensorCount, seeker.customSensorCount, host.customSensors.length]).toEqual([1, 1, 1]);
  });

  it('read agent fields only in each tick, and operators only in each generation', () => {
    expect(errors(inHideSeekTick('  reward 1 when agent.isHider and agent.hidden'))).toEqual([]);
    expect(errors(inHideSeekGeneration('  prepTime(length: 10 s)\n  useLayout(id: "shelter")'))).toEqual([]);
    expect(errors(inHideSeekGeneration('  let h = agent.isHider')).map((d) => d.code)).toEqual(['wrong-scope']);
    expect(errors(inHideSeekTick('  prepTime(length: 10 s)')).map((d) => d.code)).toEqual(['wrong-scope']);
    expect(errors(inHideSeekGeneration('  useLayout(id: "moon")')).map((d) => d.code)).toEqual(['unknown-choice']);
    expect(errors(inHideSeekGeneration('  prepTime(length: 10)')).map((d) => d.code)).toEqual(['unit-mismatch']);
  });

  it('team blocks survive the block view and the printer', () => {
    const text = inHideSeekTick('  if agent.isHider {\n    reward +1 * dt when agent.hidden\n  } else {\n    reward +1 * dt when agent.seesOpponent\n  }');
    const program = parse(text).program;
    expect(print(fromBlocks(toBlocks(program)))).toBe(print(program));
  });

  it('have a block palette built from the registry', () => {
    const tick = blockPalette('hideseek', 'tick').flatMap((c) => c.items.map((i) => i.key));
    expect(tick).toEqual(expect.arrayContaining(['act', 'brain.move', 'brain.lock', 'agent.isHider', 'agent.exposed', 'rays', 'reward']));
    expect(tick).not.toContain('drive');
    const generation = blockPalette('hideseek', 'generation').flatMap((c) => c.items);
    expect(generation.map((i) => i.key)).toEqual(expect.arrayContaining(['opponents', 'prepTime', 'useLayout', 'hallOfFame', 'speciate']));
    // Statement templates only: value templates need a slot to sit in, which blocks.test.ts covers.
    for (const item of generation.filter((i) => i.template.type === 'call')) {
      const ws = toBlocks(parse(inHideSeekGeneration('  keepChampions()')).program);
      const block = ws.items.find((b) => b.type === 'each' && b.fields.event === 'generation')!;
      block.children.body = [item.template];
      expect(parse(print(fromBlocks(ws))).diagnostics, item.key).toEqual([]);
    }
  });
});
