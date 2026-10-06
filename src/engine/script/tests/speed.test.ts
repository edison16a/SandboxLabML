import { describe, expect, it } from 'vitest';
import type { AgentController } from '../../env/types';
import { Population } from '../../neat/population';
import { builtinRacingController } from '../../racing/builtinReward';
import { DEFAULT_CAR } from '../../racing/car/params';
import type { RacingCar } from '../../racing/car/runtime';
import type { RacingEnvOptions } from '../../racing/env';
import { evaluateRacing } from '../../racing/episode';
import { STANDARD_RACING_INPUTS } from '../../racing/sensors/inputConfig';
import { buildTrack } from '../../racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '../../racing/track/presets';
import { compileScript } from '../compiler';
import { costToMicros } from '../cost';
import { findScriptPreset } from '../presets/racing';

const track = buildTrack(BUILT_IN_TRACKS[0]);
const options = (controller: AgentController<RacingCar>): RacingEnvOptions => ({ track, car: DEFAULT_CAR, inputs: STANDARD_RACING_INPUTS, controller, maxTime: 60 });

describe('turbo speed', () => {
  it('the Intermediate preset runs at least 80% as fast as the built-in reward', () => {
    const script = compileScript(findScriptPreset('racing-intermediate')!.source).script!;
    // Evolve a little first, so cars drive long enough for the reward to matter.
    const pop = Population.create({ inputCount: 11, outputCount: 2, activation: 'tanh', wiring: 'direct' }, 5, { populationSize: 60 });
    for (let gen = 0; gen < 6; gen++) {
      evaluateRacing(pop.genomes, options(builtinRacingController)).forEach((r, i) => (pop.genomes[i].fitness = r.fitness));
      pop.advance();
    }
    const time = (make: () => AgentController<RacingCar>) => {
      const t0 = performance.now();
      for (let i = 0; i < 3; i++) evaluateRacing(pop.genomes, options(make()));
      return performance.now() - t0;
    };
    let builtin = Infinity;
    let scripted = Infinity;
    // Alternate the two and keep the best of each, so JIT warmup and GC pauses do not pick a winner.
    for (let round = 0; round < 5; round++) {
      builtin = Math.min(builtin, time(() => builtinRacingController));
      scripted = Math.min(scripted, time(() => script.createController({ seed: 1, track })));
    }
    const ratio = builtin / scripted;
    console.log(`script speed: ${(ratio * 100).toFixed(0)}% of built-in (${builtin.toFixed(0)} ms vs ${scripted.toFixed(0)} ms), estimated ${costToMicros(script.costEstimate).toFixed(2)} µs per tick`);
    expect(ratio).toBeGreaterThanOrEqual(0.8);
  });
});
