import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../../../neat/population';
import { DEFAULT_NEAT } from '../../../neat/config';
import { Rng } from '../../../core/rng';
import { compileScript } from '../../compiler';
import { scriptEnv } from '../../envs';
import { entriesByName, SLICES } from '../index';
import { errors } from '../../tests/helpers';
import { DRIVING_SLICE } from './index';

const CATEGORIES = ['sensors', 'actions', 'rewards', 'logic', 'math', 'evolution', 'environment'];
const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0).length;
const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const DRIVE = '  drive(steer: brain.steer, pedal: brain.pedal)';

function inTick(lines: string): string {
  return `script "t" for driving v1\nbrain driving-standard\n\neach tick {\n${DRIVE}\n${lines}\n}\n`;
}

function inGeneration(lines: string): string {
  return `script "t" for driving v1\neach tick {\n${DRIVE}\n}\n\neach generation {\n${lines}\n}\n`;
}

/** Runs a generation block once and returns what it asked of the env. */
function requests(lines: string, metrics: Record<string, number> = {}): Record<string, unknown> | undefined {
  const { script } = compileScript(inGeneration(lines));
  if (!script) throw new Error('did not compile');
  const ctx = { generation: 4, speciesCount: 6, bestFitness: 10, meanFitness: 2, stagnation: 0, metrics };
  return script.runGeneration(ctx, new Rng(1), DEFAULT_NEAT).env;
}

describe('the driving script slice', () => {
  for (const e of DRIVING_SLICE.entries) {
    it(`${e.name} is documented and its example compiles`, () => {
      expect(e.env).toBe('driving');
      expect(sentences(e.summary)).toBe(1);
      const count = sentences(e.description);
      expect(count, e.description).toBeGreaterThanOrEqual(2);
      expect(count, e.description).toBeLessThanOrEqual(4);
      expect(CATEGORIES).toContain(e.block.category);
      for (const hole of [...holes(e.block.label), ...holes(e.explain)]) expect(e.params.map((p) => p.name)).toContain(hole);
      const body = `  ${e.example.replace(/\n/g, '\n  ')}`;
      const sources = [e.scope !== 'generation' && inTick(body), e.scope !== 'tick' && inGeneration(body)].filter((s) => typeof s === 'string');
      for (const source of sources) {
        expect(errors(source), source).toEqual([]);
        expect(() => compileScript(source).script?.createController({ seed: 1 })).not.toThrow();
      }
    });
  }

  it('keeps names unique next to the core slices', () => {
    const names = SLICES.filter((s) => s.env === 'core' || s.env === 'driving').flatMap((s) => s.entries.map((e) => e.name));
    expect(new Set(names).size).toBe(names.length);
    expect(entriesByName('driving').size).toBe(names.length);
  });

  it('has a starter that compiles for driving', () => {
    const { script, diagnostics } = compileScript(scriptEnv('driving')!.starter);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(script?.header.env).toBe('driving');
  });

  it('turns the operators into env requests', () => {
    expect(requests('  useLevel(level: 3)\n  routesPerGeneration(count: 3)\n  useCity(id: "harbor")')).toEqual({ level: 3, trips: 3, city: 'harbor' });
    expect(requests('  autoLevel(share: 40%)')).toEqual({ autoLevel: 0.4 });
    expect(requests('  randomCity(seed: generation)')).toEqual({ city: 'random-4' });
    expect(requests('  if drives.safe > 50% {\n    useLevel(level: 9)\n  }', { safe: 0.6 })).toEqual({ level: 5 });
    expect(requests('  if drives.safe > 50% {\n    useLevel(level: 2)\n  }', { safe: 0.1 })).toBeUndefined();
  });

  it('leaves the NEAT plan alone when it only changes the city', () => {
    const { script } = compileScript(inGeneration('  useCity(id: "old-town")'));
    const plan = script!.runGeneration({ generation: 0, speciesCount: 1, bestFitness: 0, meanFitness: 0, stagnation: 0 }, new Rng(1), DEFAULT_NEAT).plan;
    expect(plan).toEqual(defaultPlan(DEFAULT_NEAT));
  });

  it('does not leak Navigation names into Driving scripts', () => {
    expect(errors(inTick('  reward 1 when agent.finished')).map((d) => d.code)).toContain('wrong-env');
  });
});
