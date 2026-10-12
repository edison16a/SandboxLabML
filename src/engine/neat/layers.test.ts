import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { countGenome, createGenome, createTemplate, InnovationTracker, Network, startingLinks, type Genome, type GenomeShape } from './index';

/** Longest chain of enabled links from an input or the bias to any output, for tests about a brain's depth. */
function depthOf(g: Genome): number {
  const depth = new Map<number, number>();
  for (const id of [...g.inputs, g.biasId]) depth.set(id, 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of g.connections) {
      if (!c.enabled || !depth.has(c.from)) continue;
      const d = depth.get(c.from)! + 1;
      if (d > (depth.get(c.to) ?? -1)) {
        depth.set(c.to, d);
        changed = true;
      }
    }
  }
  return Math.max(...g.outputs.map((o) => depth.get(o) ?? 0));
}

function build(shape: GenomeShape) {
  const tracker = new InnovationTracker();
  return createGenome(createTemplate(shape, tracker), tracker, new Rng(3), 0);
}

const base = { inputCount: 5, outputCount: 2, activation: 'tanh' } as const;

describe('starting with hidden layers', () => {
  it('stacks the layers, each fed by the one before plus the bias', () => {
    const g = build({ ...base, wiring: 'hidden', hiddenCount: 4, hiddenLayers: 3 });
    expect(countGenome(g)).toMatchObject({ hidden: 12 });
    // Three hidden layers put the outputs four links from the inputs.
    expect(depthOf(g)).toBe(4);
    expect(g.connections).toHaveLength(startingLinks({ ...base, wiring: 'hidden', hiddenCount: 4, hiddenLayers: 3 }));
  });

  it('builds one layer exactly as before when no layer count is given', () => {
    const one = build({ ...base, wiring: 'hidden', hiddenCount: 4 });
    const explicit = build({ ...base, wiring: 'hidden', hiddenCount: 4, hiddenLayers: 1 });
    expect(one.connections).toEqual(explicit.connections);
    expect(depthOf(one)).toBe(2);
    expect(one.connections).toHaveLength((5 + 1) * 4 + (4 + 1) * 2);
  });

  it('runs a deep brain to outputs in range', () => {
    const net = new Network(build({ ...base, wiring: 'hidden', hiddenCount: 3, hiddenLayers: 2 }));
    const out = new Float64Array(2);
    net.activate([0.2, -0.5, 1, 0, 0.7], out);
    expect(out.some((v) => v !== 0)).toBe(true);
    for (const v of out) expect(Math.abs(v)).toBeLessThanOrEqual(1);
  });

  it('counts starting weights for every wiring', () => {
    expect(startingLinks({ ...base, wiring: 'direct' })).toBe(12);
    expect(startingLinks({ ...base, wiring: 'sparse' })).toBe(7);
    expect(startingLinks({ ...base, wiring: 'hidden', hiddenCount: 4, hiddenLayers: 2 })).toBe(24 + 20 + 10);
  });
});
