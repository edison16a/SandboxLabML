import { mixSeed } from '../../src/engine/core/rng';
import {
  advanceCurriculum,
  builtinDrivingController,
  builtInInputCount,
  createDrivingSetup,
  DRIVING_NEAT,
  drivingEnvOptions,
  evaluateDriving,
  STANDARD_DRIVING_INPUTS,
  startCurriculum,
  SUV,
  type Curriculum,
} from '../../src/engine/driving';
import { Network } from '../../src/engine/neat/network';
import { Population } from '../../src/engine/neat/population';

/** One generation of a headless Driving run, as the log and the test see it. */
export interface CurriculumGeneration {
  generation: number;
  level: number;
  safe: number;
  reasons: Record<string, number>;
  next: Curriculum;
}

export interface CurriculumRunOptions {
  seed: number;
  generations: number;
  population?: number;
  /** Stop early once the curriculum reaches this level. */
  until?: number;
  onGeneration?: (g: CurriculumGeneration) => void;
}

/**
 * Trains a Driving population the way a default run without a script does:
 * the standard inputs, direct tanh wiring, the Driving NEAT settings, the
 * built in reward, a new trip every generation and the automatic
 * curriculum. Returns the generation at which each level was first played
 * (index 0 is level 1).
 */
export function trainWithCurriculum(opts: CurriculumRunOptions): number[] {
  const inputs = STANDARD_DRIVING_INPUTS;
  const pop = Population.create({ inputCount: builtInInputCount(inputs), outputCount: 2, activation: 'tanh', wiring: 'direct' }, opts.seed, { ...DRIVING_NEAT, populationSize: opts.population ?? 100 });
  let cur = startCurriculum(1);
  const reached = [0];
  for (let gen = 0; gen < opts.generations; gen++) {
    const setup = createDrivingSetup({ level: cur.level, seed: mixSeed(opts.seed, gen) });
    const env = drivingEnvOptions(setup, SUV, inputs, builtinDrivingController);
    const results = evaluateDriving(
      pop.genomes.map((g) => new Network(g)),
      env,
      pop.genomes.map((g) => g.id),
    );
    results.forEach((r, i) => (pop.genomes[i].fitness = r.fitness));
    const safe = results.filter((r) => r.safe).length;
    const reasons: Record<string, number> = {};
    for (const r of results) reasons[r.stopReason ?? 'none'] = (reasons[r.stopReason ?? 'none'] ?? 0) + 1;
    const next = advanceCurriculum(cur, safe, results.length);
    opts.onGeneration?.({ generation: gen, level: cur.level, safe, reasons, next });
    if (next.level > cur.level && reached[next.level - 1] === undefined) reached[next.level - 1] = gen + 1;
    cur = next;
    if (opts.until && cur.level >= opts.until) break;
    pop.advance();
  }
  return reached;
}
