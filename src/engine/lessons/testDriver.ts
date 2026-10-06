import type { InputSpec } from '../env/types';
import { Population } from '../neat/population';
import type { Genome, GenomeShape } from '../neat/types';

/** Seed for the test brain's genome ids. Its weights are set by hand below, so only the structure comes from it. */
export const TEST_BRAIN_SEED = 0x7e57;

/** How hard the test brain steers toward open road, and how it holds a gentle speed. */
const STEER_GAIN = 6;
const HEADING_GAIN = -3;
const THROTTLE = 0.8;
const SPEED_BRAKE = -3;

/**
 * The fixed brain every lesson test drive uses. A random brain would make a
 * test drive mean something different for every brain shape, so this one
 * has hand-set weights instead: it steers toward the side with more room,
 * against its heading error, and eases off the throttle as it speeds up.
 * It drives a gentle line, which makes rewards and stop rules easy to see.
 * With a single ray it has nothing to compare and drives straight.
 */
export function testDriverGenome(shape: GenomeShape, schema: readonly InputSpec[]): Genome {
  const genome = Population.create({ ...shape, wiring: 'direct' }, TEST_BRAIN_SEED, { populationSize: 1 }).genomes[0];
  const [steerOut, pedalOut] = genome.outputs;
  for (const c of genome.connections) {
    c.weight = 0;
    const input = genome.inputs.indexOf(c.from);
    const spec = input >= 0 ? schema[input] : undefined;
    if (c.to === steerOut) {
      if (spec?.ray) c.weight = STEER_GAIN * Math.sign(spec.ray.angle);
      else if (spec?.key === 'headingError') c.weight = HEADING_GAIN;
    } else if (c.to === pedalOut) {
      if (c.from === genome.biasId) c.weight = THROTTLE;
      else if (spec?.key === 'speed') c.weight = SPEED_BRAKE;
    }
  }
  return genome;
}
