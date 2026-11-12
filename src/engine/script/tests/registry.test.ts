import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { episodeInfo, registerEpisodeModule } from '../../env/registry';
import { toyModule } from '../../env/tests/toyEnv';
import { TOY_SCRIPT_ENV } from '../../env/tests/toyScript';
import { migrate } from '../autocorrect';
import { compileScript } from '../compiler';
import { registerScriptEnv } from '../envs';
import { SCRIPT_PRESETS } from '../presets';
import { REGISTRY, SLICES, entriesByName, type RegistryEntry } from '../registry';
import { TICK_DT } from '../registry/core';
import { check } from '../checker';
import { parse } from '../parser';
import { errors, inGeneration, inNavigationGeneration, inNavigationTick, inTick, problems } from './helpers';

const CATEGORIES = ['sensors', 'actions', 'rewards', 'logic', 'math', 'evolution', 'environment'];
const TIERS = ['beginner', 'intermediate', 'advanced'];

const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0).length;
const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

/**
 * Wraps an example in the block its scope needs, or in both for entries
 * usable anywhere, in a script for the entry's environment. Core entries
 * are tried in every environment.
 */
function exampleScripts(e: RegistryEntry): string[] {
  const body = `  ${e.example.replace(/\n/g, '\n  ')}`;
  const out: string[] = [];
  if (e.env === 'core') {
    if (e.scope !== 'generation') out.push(inTick(`  drive(steer: brain.steer, pedal: brain.pedal)\n${body}`));
    if (e.scope !== 'tick') out.push(inGeneration(body));
  }
  if (e.env === 'navigation' || e.env === 'core') {
    if (e.scope !== 'generation') out.push(inNavigationTick(body));
    if (e.scope !== 'tick') out.push(inNavigationGeneration(body));
  }
  return out;
}

describe('registry entries', () => {
  // Driving checks its own slice in registry/driving/driving.test.ts.
  for (const e of REGISTRY.filter((x) => x.env === 'core' || x.env === 'navigation')) {
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
        expect(() => compileScript(source).script?.createController({ seed: 1 })).not.toThrow();
      }
    });
  }

  /** Registry entries a preset reads or calls. */
  function usedBy(source: string): RegistryEntry[] {
    const checked = check(parse(source).program);
    const used = new Set<RegistryEntry>([...checked.calls.values()].map((c) => c.entry));
    for (const info of checked.exprs.values()) if (info.ref?.kind === 'entry') used.add(info.ref.entry);
    return [...used];
  }

  // Each env compares its own entries with its own presets (see navigationPresets.test.ts and registry/driving/presets.test.ts).
  it('core entries list exactly the tiers whose preset uses them, in any env', () => {
    for (const e of REGISTRY.filter((x) => x.env === 'core')) {
      const tiers = new Set(SCRIPT_PRESETS.filter((p) => usedBy(p.source).includes(e)).map((p) => p.tier));
      expect([...e.presets].sort(), e.name).toEqual([...tiers].sort());
    }
  });

  it('names are unique within each environment', () => {
    for (const env of ['driving', 'navigation'] as const) {
      const names = SLICES.filter((s) => s.env === 'core' || s.env === env).flatMap((s) => s.entries.map((e) => e.name));
      expect(new Set(names).size).toBe(names.length);
      expect(entriesByName(env).size).toBe(names.length);
    }
  });

  it('the tick length matches the simulation step of every env', () => {
    for (const env of ['driving', 'navigation']) expect(TICK_DT).toBe(1 / episodeInfo(env)!.tickHz);
  });

  it('does not leak Driving names into Navigation scripts', () => {
    const source = 'script "h" for navigation v1\neach tick {\n  reward 1 when car.offRoad\n}\n';
    expect(errors(source).map((d) => d.code)).toContain('wrong-env');
  });
});

// No shipped entry has an old name yet, so the toy env carries one: walker.x was once walker.position.
describe('renamed entries', () => {
  let undo: Array<() => void> = [];
  beforeAll(() => {
    undo = [registerEpisodeModule(toyModule), registerScriptEnv(TOY_SCRIPT_ENV)];
  });
  afterAll(() => undo.forEach((f) => f()));

  const toy = (when: string) => `script "t" for toy v1\nbrain toy-basic\n\neach tick {\n  walk(move: brain.move)\n  reward 1 when ${when} > 2 m\n  stop "far" when ${when} > 8 m\n}\n`;
  const OLD = toy('walker.position');
  const NEW = toy('walker.x');

  it('an old script still compiles, with a warning that offers the new name', () => {
    const found = problems(OLD).filter((d) => d.code === 'renamed');
    expect(found.map((d) => d.message)).toEqual(['walker.position is now called walker.x.', 'walker.position is now called walker.x.']);
    expect(compileScript(OLD).script).not.toBeNull();
  });

  it('the checker rewrites the tree, so old and new scripts are the same program', () => {
    expect(compileScript(OLD).script?.sourceHash).toBe(compileScript(NEW).script?.sourceHash);
  });

  it('migrate rewrites the text', () => {
    expect(migrate(OLD)).toBe(NEW);
    expect(migrate(NEW)).toBe(NEW);
  });

  it('a renamed name of another env is not offered', () => {
    expect(problems(inTick(`  drive(steer: brain.steer, pedal: brain.pedal)\n  reward 1 when walker.position > 2 m`)).map((d) => d.code)).not.toContain('renamed');
  });
});
