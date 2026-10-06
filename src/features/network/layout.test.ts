import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/core/rng';
import { createGenome, createTemplate } from '@/engine/neat/genome';
import { InnovationTracker } from '@/engine/neat/innovation';
import { mutateAddConnection, mutateAddNode } from '@/engine/neat/mutation';
import { layoutGenome } from './layout';

describe('layoutGenome', () => {
  it('puts inputs left, outputs right and hidden nodes after their sources', () => {
    const tracker = new InnovationTracker();
    const template = createTemplate({ inputCount: 5, outputCount: 2, activation: 'tanh', wiring: 'direct' }, tracker);
    const rng = new Rng(4);
    const g = createGenome(template, tracker, rng, 0);
    for (let i = 0; i < 12; i++) {
      mutateAddNode(g, tracker, rng);
      mutateAddConnection(g, tracker, rng);
    }
    const nodes = layoutGenome(g);
    const x = new Map(nodes.map((n) => [n.id, n.x]));
    for (const id of g.inputs) expect(x.get(id)).toBe(0);
    for (const id of g.outputs) expect(x.get(id)).toBe(1);
    for (const c of g.connections) if (c.enabled) expect(x.get(c.from)!).toBeLessThan(x.get(c.to)!);
    for (const n of nodes) {
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(1);
    }
  });
});
