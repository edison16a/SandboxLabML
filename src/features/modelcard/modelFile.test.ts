import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/core/rng';
import { createGenome, createTemplate, decodeGenome, base64ToBytes, InnovationTracker, Network } from '@/engine/neat';
import type { RunConfig } from '@/engine/training/runConfig';
import { MODEL_FORMAT, modelFile, modelFileName } from './modelFile';

function genome() {
  const tracker = new InnovationTracker();
  const template = createTemplate({ inputCount: 3, outputCount: 2, activation: 'tanh', wiring: 'hidden', hiddenCount: 2, hiddenLayers: 2 }, tracker);
  return createGenome(template, tracker, new Rng(5), 0);
}

const run = { id: 'r1', name: 'Oval laps', env: 'racing' } as RunConfig;

/** Runs the file's own description of the network, the way code outside the app would. */
function runFile(file: ReturnType<typeof modelFile>, inputs: number[]): number[] {
  const value = new Map<number, number>();
  file.neurons.forEach((n) => n.kind === 'bias' && value.set(n.id, 1));
  const inputIds = file.neurons.filter((n) => n.kind === 'input').map((n) => n.id);
  inputIds.forEach((id, i) => value.set(id, inputs[i]));
  for (const id of file.order) {
    let sum = 0;
    for (const l of file.links) if (l.enabled && l.to === id) sum += (value.get(l.from) ?? 0) * l.weight;
    value.set(id, Math.tanh(sum));
  }
  return file.neurons.filter((n) => n.kind === 'output').map((n) => value.get(n.id) ?? 0);
}

describe('the model file', () => {
  it('labels the inputs and outputs and keeps an exact copy of the brain', () => {
    const g = genome();
    const file = modelFile({ run, genome: g, generation: 9, fitness: 12.5, inputLabels: ['left', 'ahead', 'right'], outputLabels: ['steer', 'pedal'] });
    expect(file.format).toBe(MODEL_FORMAT);
    expect(file.inputs).toEqual(['left', 'ahead', 'right']);
    expect(file.outputs).toEqual(['steer', 'pedal']);
    expect(decodeGenome(base64ToBytes(file.genome)).connections).toEqual(g.connections);
  });

  it('describes a network that gives the same outputs when run by hand', () => {
    const g = genome();
    const file = modelFile({ run, genome: g, generation: 0, fitness: 0, inputLabels: [], outputLabels: [] });
    const out = new Float64Array(2);
    new Network(g).activate([0.3, -0.2, 0.9], out);
    const byHand = runFile(file, [0.3, -0.2, 0.9]);
    expect(byHand[0]).toBeCloseTo(out[0], 5);
    expect(byHand[1]).toBeCloseTo(out[1], 5);
  });

  it('names the file after the run, the generation and the team', () => {
    expect(modelFileName('Oval laps!', 41)).toBe('oval-laps-gen-42.model.json');
    expect(modelFileName('Shelter', 0, 'hider')).toBe('shelter-gen-1-hider.model.json');
  });
});
