import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { createGenome, createTemplate } from '../neat/genome';
import { InnovationTracker } from '../neat/innovation';
import { mutateAddConnection, mutateAddNode } from '../neat/mutation';
import { Network } from '../neat/network';
import { forkGenome, populationFromChampion, trackerFromGenomes } from './branch';

function grown() {
  const tracker = new InnovationTracker();
  const template = createTemplate({ inputCount: 4, outputCount: 2, activation: 'tanh', wiring: 'direct' }, tracker);
  const rng = new Rng(8);
  const g = createGenome(template, tracker, rng, 0);
  for (let i = 0; i < 10; i++) {
    mutateAddNode(g, tracker, rng);
    mutateAddConnection(g, tracker, rng);
  }
  return g;
}

describe('forkGenome', () => {
  it('gives identical outputs on 1,000 random observations after adding unconnected inputs', () => {
    const g = grown();
    const oldKeys = ['ray:-45', 'ray:0', 'ray:45', 'speed'];
    const newKeys = ['ray:-45', 'ray:0', 'ray:45', 'speed', 'curvatureNear', 'custom:next'];
    const forked = forkGenome(g, oldKeys, newKeys, trackerFromGenomes([g]));
    expect(forked.inputs).toHaveLength(6);
    const a = new Network(g);
    const b = new Network(forked);
    const rng = new Rng(3);
    const oa = new Float64Array(2);
    const ob = new Float64Array(2);
    for (let k = 0; k < 1000; k++) {
      const obs = Array.from({ length: 4 }, () => rng.range(-1, 1));
      a.activate(obs, oa);
      b.activate([...obs, rng.range(-1, 1), rng.range(-1, 1)], ob);
      expect(Array.from(ob)).toEqual(Array.from(oa));
    }
  });

  it('removes an input together with its links', () => {
    const g = grown();
    const forked = forkGenome(g, ['a', 'b', 'c', 'd'], ['a', 'c', 'd'], trackerFromGenomes([g]));
    expect(forked.inputs).toEqual([g.inputs[0], g.inputs[2], g.inputs[3]]);
    expect(forked.connections.some((c) => c.from === g.inputs[1])).toBe(false);
  });
});

describe('populationFromChampion', () => {
  it('keeps one exact copy and varies the rest', () => {
    const g = grown();
    const pop = populationFromChampion(g, 20, 1);
    expect(pop).toHaveLength(20);
    expect(pop[0].connections).toEqual(g.connections);
    expect(pop[5].connections).not.toEqual(g.connections);
    expect(new Set(pop.map((p) => p.id)).size).toBe(20);
  });
});
