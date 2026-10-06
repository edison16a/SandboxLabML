import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../../racing/car/params';
import { buildTrack } from '../../racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '../../racing/track/presets';
import { migrate } from '../autocorrect';
import { compileScript } from '../compiler';
import { REGISTRY, SLICES, entriesByName, type RegistryEntry } from '../registry';
import { TICK_DT } from '../registry/core';
import { errors, inGeneration, inTick, problems } from './helpers';

const CATEGORIES = ['sensors', 'actions', 'rewards', 'logic', 'math', 'evolution', 'environment'];
const TIERS = ['beginner', 'intermediate', 'advanced'];

const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0).length;
const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

/** Wraps an example in the block its scope needs, or in both for entries usable anywhere. */
function exampleScripts(e: RegistryEntry): string[] {
  if (e.scope === 'generation') return [inGeneration(`  ${e.example.replace(/\n/g, '\n  ')}`)];
  const tick = inTick(`  drive(steer: brain.steer, pedal: brain.pedal)\n  ${e.example.replace(/\n/g, '\n  ')}`);
  if (e.scope === 'tick') return [tick];
  return [tick, inGeneration(`  ${e.example.replace(/\n/g, '\n  ')}`)];
}

describe('registry entries', () => {
  for (const e of REGISTRY) {
    it(`${e.name} is documented and its example compiles`, () => {
      expect(e.summary.length).toBeGreaterThan(10);
      expect(sentences(e.summary)).toBe(1);
      const count = sentences(e.description);
      expect(count, e.description).toBeGreaterThanOrEqual(2);
      expect(count, e.description).toBeLessThanOrEqual(4);
      expect(e.explain.length).toBeGreaterThan(3);
      expect(CATEGORIES).toContain(e.block.category);
      expect(e.block.label.length).toBeGreaterThan(1);
      const params = e.params.map((p) => p.name);
      for (const hole of [...holes(e.block.label), ...holes(e.explain)]) expect(params).toContain(hole);
      for (const p of e.params) expect(p.summary.length).toBeGreaterThan(5);
      for (const t of e.presets) expect(TIERS).toContain(t);
      expect(e.cost).toBeGreaterThan(0);
      for (const source of exampleScripts(e)) {
        expect(errors(source), source).toEqual([]);
        const track = buildTrack(BUILT_IN_TRACKS[0]);
        expect(() => compileScript(source).script?.createController({ seed: 1, track })).not.toThrow();
      }
    });
  }

  it('names are unique within each environment', () => {
    for (const env of ['racing', 'hideseek'] as const) {
      const names = SLICES.filter((s) => s.env === 'core' || s.env === env).flatMap((s) => s.entries.map((e) => e.name));
      expect(new Set(names).size).toBe(names.length);
      expect(entriesByName(env).size).toBe(names.length);
    }
  });

  it('the tick length matches the racing simulation step', () => {
    expect(TICK_DT).toBe(SIM_DT);
  });

  it('does not leak racing names into hide and seek scripts', () => {
    const source = 'script "h" for hideseek v1\neach tick {\n  reward 1 when car.offTrack\n}\n';
    expect(errors(source).map((d) => d.code)).toContain('wrong-env');
  });
});

describe('renamed entries', () => {
  const OLD = inTick('  drive(steer: brain.steer, pedal: brain.pedal)\n  reward +1 when checkpoint.hit\n  stop "crash" when car.offRoad');
  const NEW = inTick('  drive(steer: brain.steer, pedal: brain.pedal)\n  reward +1 when checkpoint.passed\n  stop "crash" when car.offTrack');

  it('an old script still compiles, with a warning that offers the new name', () => {
    const found = problems(OLD).filter((d) => d.code === 'renamed');
    expect(found.map((d) => d.message)).toEqual(['checkpoint.hit is now called checkpoint.passed.', 'car.offRoad is now called car.offTrack.']);
    expect(compileScript(OLD).script).not.toBeNull();
  });

  it('the checker rewrites the tree, so old and new scripts are the same program', () => {
    expect(compileScript(OLD).script?.sourceHash).toBe(compileScript(NEW).script?.sourceHash);
  });

  it('migrate rewrites the text', () => {
    expect(migrate(OLD)).toBe(NEW);
    expect(migrate(NEW)).toBe(NEW);
  });
});
