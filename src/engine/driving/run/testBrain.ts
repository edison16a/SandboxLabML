import type { InputSpec } from '../../env/types';
import { TEST_BRAIN_SEED } from '../../lessons/shared';
import { Population } from '../../neat/population';
import type { Genome, GenomeShape } from '../../neat/types';

/**
 * The hand set weights of the fixed test driver, by input key: steer
 * toward the lane just ahead, hold a calm pace and slow down over the last
 * stretch to the destination. Speed is normalized by the top speed and the
 * destination input reads 1 while it is far, so the pedal crosses zero
 * near 6.7 m/s on the way and close to a stop in the destination zone.
 */
const STEER_WEIGHTS: Readonly<Record<string, number>> = { aim: 3 };
const PEDAL_WEIGHTS: Readonly<Record<string, number>> = { speed: -2.4, destination: 0.8 };

/**
 * One hidden neuron that fires for "red light, and its stop line is
 * close": a straight wired brain can only add its inputs up, so it could
 * brake for every red within 80 m or for none. This one fires past about
 * 16 m from the line, and the pedal brakes while it does, so the driver
 * comes to rest in the last stretch before the line, where waiting counts
 * as waiting.
 */
const RED_WEIGHTS: Readonly<Record<string, number>> = { light: 8, lightDistance: -8 };
const RED_BIAS = -6.4;
/** The pedal reads the neuron as (red + 1), so a quiet neuron at -1 changes nothing. */
const RED_TO_PEDAL = -1.5;

/** An id above anything the template uses, for the hand added neuron and its links. */
const HAND = 1_000_000;

/**
 * A brain with every weight set by hand: the driver Studio test runs,
 * lesson checks and lesson previews use, so a test means the same thing
 * for every script and brain shape. It follows its route, waits at red
 * lights and slows into the destination, and it ignores people and other
 * cars, so it arrives on empty streets and with lights, and the rules
 * past that are for evolved brains to learn. Inputs a blueprint does not
 * have are skipped.
 */
export function drivingTestBrain(shape: GenomeShape, schema: readonly InputSpec[]): Genome {
  const genome = Population.create({ ...shape, wiring: 'direct', hiddenCount: undefined, hiddenLayers: undefined }, TEST_BRAIN_SEED, { populationSize: 1 }).genomes[0];
  const [steer, pedal] = genome.outputs;
  const keyOf = (id: number) => schema[genome.inputs.indexOf(id)]?.key ?? '';
  for (const c of genome.connections) {
    const key = keyOf(c.from);
    c.weight = (c.to === steer ? STEER_WEIGHTS[key] : c.to === pedal ? PEDAL_WEIGHTS[key] : 0) ?? 0;
  }
  const red = HAND;
  let innovation = HAND;
  const link = (from: number, to: number, weight: number) => genome.connections.push({ innovation: ++innovation, from, to, weight, enabled: true });
  genome.nodes.push({ id: red, kind: 'hidden' });
  // The hidden neuron squashes with tanh like the outputs, whatever the blueprint picked for evolved brains.
  genome.activation = 'tanh';
  link(genome.biasId, red, RED_BIAS);
  genome.inputs.forEach((id) => {
    const w = RED_WEIGHTS[keyOf(id)];
    if (w !== undefined) link(id, red, w);
  });
  link(red, pedal, RED_TO_PEDAL);
  // Cancels the quiet neuron's -1, so with no red light near the pedal is the plain sum above.
  link(genome.biasId, pedal, RED_TO_PEDAL);
  return genome;
}
