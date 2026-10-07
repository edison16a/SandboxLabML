import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ReferenceChampion } from '../bench/types';
import { STANDARD_HIDESEEK_INPUTS } from '../hideseek/inputConfig';
import { Network } from '../neat/network';
import { STATUS_DRIVING } from '../racing/car/runtime';
import { RacingEnv } from '../racing/env';
import { buildTrack } from '../racing/track/buildTrack';
import { mixSeed } from '../core/rng';
import { envOptionsFor } from '../training/racingSetup';
import { builtinHost } from '../training/scriptHost';
import { pickShowcasePair, READABLE_INPUTS, showcaseMatch, SHOWCASE_ROOMS } from './arena';
import { HERO_MAX_TIME, parseHeroRacer } from './racer';

const shipped = () => JSON.parse(readFileSync('public/hero/racer.json', 'utf8')) as Record<string, unknown>;

describe('hero racer file', () => {
  it('parses the shipped car into a replay setup that never times out', () => {
    const racer = parseHeroRacer(shipped());
    expect(racer).not.toBeNull();
    expect(racer?.setup.maxTime).toBe(HERO_MAX_TIME);
    expect(racer?.setup.scriptSource).toBeNull();
  });

  it('turns away a stale, foreign or broken file', () => {
    const file = shipped();
    expect(parseHeroRacer({ ...file, engineVersion: -1 })).toBeNull();
    expect(parseHeroRacer({ ...file, version: 99 })).toBeNull();
    expect(parseHeroRacer({ ...file, track: 'nowhere' })).toBeNull();
    expect(parseHeroRacer({ ...file, blueprint: 'hideseek-starter' })).toBeNull();
    expect(parseHeroRacer({ ...file, genome: 'bm90IGEgZ2Vub21l' })).toBeNull();
    expect(parseHeroRacer(null)).toBeNull();
  });

  it('drives the shipped car three clean laps, the way the replay worker plays it', () => {
    const racer = parseHeroRacer(shipped());
    if (!racer) throw new Error('The shipped hero car did not parse.');
    const env = new RacingEnv(envOptionsFor(racer.setup, buildTrack(racer.setup.track), builtinHost, mixSeed(0x9405)));
    env.reset([new Network(racer.genome)], [racer.file.replaySeed]);
    while (!env.done && env.cars[0].lap < 3) env.step();
    expect(env.cars[0].status).toBe(STATUS_DRIVING);
    expect(env.cars[0].bestLapTime).toBeCloseTo(racer.file.lapTime, 1);
  });
});

/** A champion with the given rating whose two brains have `rays` rays each. */
function champion(tier: ReferenceChampion['tier'], rating: number, rays: number): ReferenceChampion {
  const inputs = { ...STANDARD_HIDESEEK_INPUTS, rays: { ...STANDARD_HIDESEEK_INPUTS.rays, count: rays, hitTypes: false } };
  return { tier, seed: 1, generation: 10, rating, hider: { inputs, genome: '' }, seeker: { inputs, genome: '' } };
}

describe('showcase pair', () => {
  it('picks the best rated pair whose brains read at a glance', () => {
    const big = champion('advanced', 1600, 40);
    const small = champion('beginner', 1500, 4);
    const smaller = champion('intermediate', 1400, 4);
    expect(pickShowcasePair([smaller, big, small])).toBe(small);
  });

  it('falls back to the best rated pair when every brain is large, and to null with none', () => {
    const a = champion('advanced', 1500, READABLE_INPUTS);
    const b = champion('beginner', 1550, READABLE_INPUTS);
    expect(pickShowcasePair([a, b])).toBe(b);
    expect(pickShowcasePair([])).toBeNull();
  });

  it('plays the shipped references with a readable pair', () => {
    const refs = JSON.parse(readFileSync('public/references/hideseek.json', 'utf8')) as { champions: ReferenceChampion[] };
    expect(pickShowcasePair(refs.champions)).not.toBeNull();
  });
});

describe('showcase matches', () => {
  it('takes turns between the rooms and never repeats a seed', () => {
    const matches = Array.from({ length: 6 }, (_, n) => showcaseMatch(n));
    expect(matches.map((m) => m.room)).toEqual([0, 1, 2, 3, 4, 5].map((n) => SHOWCASE_ROOMS[n % SHOWCASE_ROOMS.length]));
    expect(new Set(matches.map((m) => m.seed)).size).toBe(6);
  });
});
