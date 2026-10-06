import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import {
  compatibility,
  countGenome,
  createGenome,
  createTemplate,
  crossover,
  decodeGenome,
  encodeGenome,
  genomeByteSize,
  InnovationTracker,
  mutate,
  mutateAddConnection,
  mutateAddNode,
  Network,
  Population,
  topologicalOrder,
  DEFAULT_MUTATION,
  type Genome,
} from './index';

function fresh(inputs = 3, outputs = 2, seed = 1) {
  const tracker = new InnovationTracker();
  const template = createTemplate({ inputCount: inputs, outputCount: outputs, activation: 'tanh', wiring: 'direct' }, tracker);
  const rng = new Rng(seed);
  return { tracker, template, rng, genome: createGenome(template, tracker, rng, 0) };
}

function hasCycle(g: Genome): boolean {
  return topologicalOrder(g).length !== g.nodes.length - g.inputs.length - 1 || false;
}

describe('genome', () => {
  it('wires every input and the bias to every output by default', () => {
    const { genome } = fresh(3, 2);
    expect(genome.connections).toHaveLength(8);
    expect(countGenome(genome)).toMatchObject({ inputs: 3, outputs: 2, hidden: 0, enabled: 8 });
  });

  it('shares innovation numbers for the same link across genomes', () => {
    const { tracker, template, rng } = fresh();
    const a = createGenome(template, tracker, rng, 1);
    const b = createGenome(template, tracker, rng, 2);
    expect(a.connections.map((c) => c.innovation)).toEqual(b.connections.map((c) => c.innovation));
  });
});

describe('mutation', () => {
  it('never creates a cycle, even after many structural mutations', () => {
    const { genome, tracker, rng } = fresh(4, 2, 9);
    for (let i = 0; i < 400; i++) {
      if (rng.chance(0.5)) mutateAddNode(genome, tracker, rng);
      mutateAddConnection(genome, tracker, rng);
    }
    const order = topologicalOrder(genome);
    const pos = new Map(order.map((id, i) => [id, i]));
    for (const c of genome.connections) {
      if (pos.has(c.from) && pos.has(c.to)) expect(pos.get(c.from)).toBeLessThan(pos.get(c.to) as number);
    }
    expect(hasCycle(genome)).toBe(false);
  });

  it('splitting a link keeps the network output close to before', () => {
    const { genome, tracker, rng } = fresh(2, 1, 4);
    const before = new Float64Array(1);
    const after = new Float64Array(1);
    new Network(genome).activate([0.3, -0.2], before);
    mutateAddNode(genome, tracker, rng);
    new Network(genome).activate([0.3, -0.2], after);
    expect(countGenome(genome).hidden).toBe(1);
    expect(Math.sign(after[0])).toBe(Math.sign(before[0]));
  });
});

describe('network', () => {
  it('computes a hand-built network exactly', () => {
    const { genome } = fresh(2, 1);
    // inputs 0,1 bias 2 output 3
    genome.connections[0].weight = 0.5;
    genome.connections[1].weight = -1;
    genome.connections[2].weight = 0.25;
    const out = new Float64Array(1);
    new Network(genome).activate([1, 2], out);
    expect(out[0]).toBeCloseTo(Math.tanh(0.5 - 2 + 0.25), 12);
  });

  it('reports cost as the enabled weight count', () => {
    const { genome } = fresh(3, 2);
    genome.connections[0].enabled = false;
    expect(new Network(genome).cost).toBe(7);
  });
});

describe('crossover', () => {
  it('takes structure from the fitter parent', () => {
    const { tracker, template, rng } = fresh(3, 1, 5);
    const a = createGenome(template, tracker, rng, 1);
    const b = createGenome(template, tracker, rng, 2);
    mutateAddNode(a, tracker, rng);
    a.fitness = 10;
    b.fitness = 1;
    const child = crossover(a, b, rng, 3, 1);
    expect(child.nodes.length).toBe(a.nodes.length);
    expect(child.connections.map((c) => c.innovation)).toEqual(a.connections.map((c) => c.innovation));
  });
});

describe('speciation distance', () => {
  it('is zero for identical genomes and grows with structural change', () => {
    const { genome, tracker, rng } = fresh(3, 2, 8);
    const c = { excess: 1, disjoint: 1, weight: 0.4, threshold: 3, step: 0.3, min: 0.3 };
    expect(compatibility(genome, genome, c)).toBe(0);
    const other = structuredClone(genome);
    for (let i = 0; i < 5; i++) mutateAddNode(other, tracker, rng);
    expect(compatibility(genome, other, c)).toBeGreaterThan(1);
  });
});

describe('serialization', () => {
  it('round-trips a grown genome exactly', () => {
    const { genome, tracker, rng } = fresh(9, 2, 11);
    for (let i = 0; i < 30; i++) mutate(genome, { ...DEFAULT_MUTATION, addNode: 0.5, addConnection: 0.8 }, tracker, rng, 8);
    const bytes = encodeGenome(genome);
    expect(bytes.byteLength).toBe(genomeByteSize(genome));
    const back = decodeGenome(bytes);
    expect(back.connections).toEqual(genome.connections);
    expect(back.inputs).toEqual(genome.inputs);
    expect(back.outputs).toEqual(genome.outputs);
    const a = new Float64Array(2);
    const b = new Float64Array(2);
    const obs = Array.from({ length: 9 }, (_, i) => Math.sin(i));
    new Network(genome).activate(obs, a);
    new Network(back).activate(obs, b);
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  it('matches the documented size: 19 neurons and 41 connections is about 0.8 KB', () => {
    const size = 28 + 19 * 8 + 41 * 16;
    expect(size).toBeGreaterThan(780);
    expect(size).toBeLessThan(860);
  });
});

/** Runs NEAT on XOR and returns the generation it was solved in, or Infinity. */
function solveXor(seed: number, maxGenerations = 300): number {
  const pop = Population.create({ inputCount: 2, outputCount: 1, activation: 'tanh', wiring: 'direct' }, seed, { populationSize: 150 });
  const cases: Array<[number, number, number]> = [
    [0, 0, 0],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
  ];
  const out = new Float64Array(1);
  for (let gen = 0; gen < maxGenerations; gen++) {
    let solved = false;
    for (const g of pop.genomes) {
      const net = new Network(g);
      let err = 0;
      let correct = 0;
      for (const [a, b, t] of cases) {
        net.activate([a, b], out);
        const p = (out[0] + 1) / 2;
        err += Math.abs(p - t);
        if (p > 0.5 === (t === 1)) correct++;
      }
      g.fitness = (4 - err) ** 2;
      if (correct === 4) solved = true;
    }
    if (solved) return gen;
    pop.advance();
  }
  return Infinity;
}

describe('XOR', () => {
  it('is solved in under 150 generations on average', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const gens = seeds.map((s) => solveXor(s));
    const solved = gens.filter(Number.isFinite);
    expect(solved.length).toBeGreaterThanOrEqual(7);
    const mean = gens.map((g) => (Number.isFinite(g) ? g : 300)).reduce((a, b) => a + b, 0) / gens.length;
    console.log('XOR generations', gens, 'mean', mean);
    expect(mean).toBeLessThan(150);
  });

  it('is deterministic for the same seed', () => {
    expect(solveXor(21, 60)).toBe(solveXor(21, 60));
  });

  it('resumes from a saved state with identical results', () => {
    const shape = { inputCount: 2, outputCount: 1, activation: 'tanh' as const, wiring: 'direct' as const };
    const score = (p: Population) => p.genomes.forEach((g) => (g.fitness = g.connections.reduce((s, c) => s + c.weight, 0)));
    const a = Population.create(shape, 5, { populationSize: 50 });
    for (let i = 0; i < 5; i++) {
      score(a);
      a.advance();
    }
    const b = Population.fromState(structuredClone(a.toState()));
    for (let i = 0; i < 5; i++) {
      score(a);
      score(b);
      expect(b.advance()).toEqual(a.advance());
    }
    expect(b.genomes).toEqual(a.genomes);
  });
});
