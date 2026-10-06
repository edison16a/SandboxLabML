import { describe, expect, it } from 'vitest';
import { Network, Population } from './index';

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
