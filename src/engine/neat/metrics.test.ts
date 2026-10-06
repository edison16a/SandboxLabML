import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { createGenome, createTemplate } from './genome';
import { InnovationTracker } from './innovation';
import { modelMetrics } from './metrics';
import { mutateAddConnection, mutateAddNode, mutateToggle } from './mutation';
import { Network } from './network';
import { encodeGenome } from './serialize';

describe('model metrics', () => {
  it('counts parameters as enabled weights and matches the serializer size', () => {
    const tracker = new InnovationTracker();
    const template = createTemplate({ inputCount: 11, outputCount: 2, activation: 'tanh', wiring: 'direct' }, tracker);
    const rng = new Rng(2);
    const g = createGenome(template, tracker, rng, 0);
    for (let i = 0; i < 20; i++) {
      mutateAddNode(g, tracker, rng);
      mutateAddConnection(g, tracker, rng);
      mutateToggle(g, rng);
    }
    const m = modelMetrics(g);
    expect(m.parameters).toBe(g.connections.filter((c) => c.enabled).length);
    expect(m.costPerDecision).toBe(new Network(g).cost);
    expect(m.bytes).toBe(encodeGenome(g).byteLength);
    expect(m.neurons.total).toBe(g.nodes.length);
  });
});
