import type { InputSpec } from '../../env/types';
import { Population } from '../../neat/population';
import type { Genome, GenomeShape } from '../../neat/types';

/** Seed for the test brain's genome ids. Its weights are set by hand, so only the structure comes from it. */
const TEST_BRAIN_SEED = 0x7e58;
/** How hard it turns toward the way to go. A bearing of 20 degrees reads 0.11, which turns at about two thirds. */
const TURN_GAIN = 7;
/** A steady jog: tanh(0.9) is about 70% of top speed. */
const PACE = 0.9;

/**
 * The fixed brain every lesson test run uses, with hand set weights so a
 * test means the same thing for every brain shape. It jogs ahead and turns
 * toward the path hint, which leads round crates and keeps clear of
 * spikes. A brain without the hint turns toward the finish instead, which
 * walks straight into whatever stands in the way. It never times movers.
 */
export function navigationTestBrain(shape: GenomeShape, schema: readonly InputSpec[]): Genome {
  const genome = Population.create({ ...shape, wiring: 'direct' }, TEST_BRAIN_SEED, { populationSize: 1 }).genomes[0];
  const [moveOut, turnOut] = genome.outputs;
  const steerBy = schema.some((s) => s.key === 'pathHint') ? 'pathHint' : 'goalBearing';
  for (const c of genome.connections) {
    c.weight = 0;
    const input = genome.inputs.indexOf(c.from);
    if (c.to === moveOut && c.from === genome.biasId) c.weight = PACE;
    else if (c.to === turnOut && input >= 0 && schema[input]?.key === steerBy) c.weight = TURN_GAIN;
  }
  return genome;
}
