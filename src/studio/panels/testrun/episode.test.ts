import { describe, expect, it } from 'vitest';
import '@/workers/shared/loadScripts';
import { findScriptPreset } from '@/engine/script';
import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import { blueprintShape } from '@/engine/blueprints/shape';
import { Rng } from '@/engine/core/rng';
import { createGenome, createTemplate, InnovationTracker } from '@/engine/neat';
import { DEFAULT_CAR } from '@/engine/racing/car/params';
import { runTestEpisode } from './episode';

const beginner = findScriptPreset('racing-beginner')!.source;

describe('test run episode', () => {
  it('drives one car with a random brain and logs every tick', () => {
    const r = runTestEpisode({ source: beginner, trackId: 'oval', brain: { kind: 'random', seed: 3 }, seed: 1 });
    if (!r.ok) throw new Error(r.message);
    expect(r.ticks).toBeGreaterThan(0);
    expect(r.log.time).toHaveLength(r.ticks);
    expect(r.log.total[r.ticks - 1]).toBeCloseTo(r.totalReward, 4);
    expect(r.log.events.at(-1)?.text).toMatch(/^stopped: /);
    expect(r.scriptMicros).toBeGreaterThan(0);
    expect(r.turboShare).toBeGreaterThan(0);
    expect(r.turboShare).toBeLessThanOrEqual(1);
    expect(r.blueprint).toBe('racing-starter');
  });

  it('is deterministic for the same seeds', () => {
    const a = runTestEpisode({ source: beginner, trackId: 'sprint', brain: { kind: 'random', seed: 9 }, seed: 2 });
    const b = runTestEpisode({ source: beginner, trackId: 'sprint', brain: { kind: 'random', seed: 9 }, seed: 2 });
    expect(a.ok && b.ok && Array.from(a.log.total)).toEqual(b.ok && Array.from(b.log.total));
  });

  it('drives a stored champion with the blueprint and car it trained with', () => {
    const blueprint = RACING_BLUEPRINTS.find((b) => b.id === 'racing-standard')!;
    const tracker = new InnovationTracker();
    const genome = createGenome(createTemplate(blueprintShape(blueprint), tracker), tracker, new Rng(5), 0);
    const champion = { kind: 'champion' as const, genome, blueprint, car: DEFAULT_CAR, maxTime: 20, label: 'run' };
    const r = runTestEpisode({ source: beginner, trackId: 'oval', brain: champion, seed: 1 });
    if (!r.ok) throw new Error(r.message);
    expect(r.blueprint).toBe('racing-standard');
    expect(r.ticks).toBeLessThanOrEqual(20 * 30 + 1);
    const withSensor = beginner.replace('brain racing-starter', 'brain racing-starter\nsensor gap "Gap" in 0 m .. 60 m = rays.min');
    const mismatch = runTestEpisode({ source: withSensor, trackId: 'oval', brain: champion, seed: 1 });
    expect(!mismatch.ok && mismatch.message).toMatch(/has 11 inputs, but .* gives 12/);
  });

  it('explains scripts it cannot run instead of throwing', () => {
    const broken = runTestEpisode({ source: 'script "x" for racing v1\neach tick {\n  reward car.sped\n}\n', trackId: 'oval', brain: { kind: 'random', seed: 1 }, seed: 1 });
    expect(broken).toMatchObject({ ok: false });
    expect(!broken.ok && broken.message).toMatch(/^Line 3: /);
    const hs = runTestEpisode({ source: 'script "x" for hideseek v1\n', trackId: 'oval', brain: { kind: 'random', seed: 1 }, seed: 1 });
    expect(!hs.ok && hs.message).toMatch(/Hide and Seek/);
  });
});
