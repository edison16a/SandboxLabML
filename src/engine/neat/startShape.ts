import type { GenomeShape } from './types';

/** Most hidden layers a brain may start with. Deeper starts learn slower than NEAT growing its own depth. */
export const MAX_HIDDEN_LAYERS = 3;

/** Neurons per hidden layer when the shape does not say. */
export const DEFAULT_HIDDEN_COUNT = 4;

/** Hidden layers a shape starts with: 0 unless it is wired through hidden neurons. */
export function hiddenLayersOf(shape: GenomeShape): number {
  if (shape.wiring !== 'hidden') return 0;
  return Math.min(MAX_HIDDEN_LAYERS, Math.max(1, Math.round(shape.hiddenLayers ?? 1)));
}

/** Neurons in each hidden layer of a shape. */
export function hiddenWidthOf(shape: GenomeShape): number {
  return Math.max(1, shape.hiddenCount ?? DEFAULT_HIDDEN_COUNT);
}

/**
 * How many weights a brain of this shape starts with. With hidden layers,
 * each layer takes every neuron of the one before plus the bias, and the
 * outputs take the last layer plus the bias. Sparse wiring keeps about half
 * the input links and always the bias, so its count is the expected one.
 */
export function startingLinks(shape: GenomeShape): number {
  const layers = hiddenLayersOf(shape);
  if (layers > 0) {
    const w = hiddenWidthOf(shape);
    return (shape.inputCount + 1) * w + (layers - 1) * (w + 1) * w + (w + 1) * shape.outputCount;
  }
  const links = (shape.inputCount + 1) * shape.outputCount;
  return shape.wiring === 'sparse' ? Math.round(shape.inputCount * shape.outputCount * 0.5 + shape.outputCount) : links;
}
