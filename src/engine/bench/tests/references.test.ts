import { afterEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_HIDESEEK_INPUTS } from '../../hideseek/inputConfig';
import { loadReferences, parseReferences, quantile, summarizeCurve } from '../references';
import type { BenchReferences, ReferenceChampion } from '../types';

const SAMPLE: BenchReferences = {
  env: 'racing',
  benchmarkVersion: 1,
  engineVersion: 1,
  generatedAt: '2026-10-06',
  seeds: 2,
  references: [{ tier: 'beginner', finalScore: 20, curve: [{ generation: 0, median: 5, p25: 4, p75: 6 }] }],
};

describe('parseReferences', () => {
  it('accepts a well formed file and rejects anything else', () => {
    expect(parseReferences(JSON.parse(JSON.stringify(SAMPLE)))).toEqual(SAMPLE);
    expect(parseReferences(null)).toBeNull();
    expect(parseReferences({ ...SAMPLE, benchmarkVersion: '1' })).toBeNull();
    expect(parseReferences({ ...SAMPLE, references: [{ tier: 'expert', finalScore: 1, curve: [] }] })).toBeNull();
    expect(parseReferences({ ...SAMPLE, references: [{ tier: 'beginner', finalScore: 1, curve: [{ generation: 0 }] }] })).toBeNull();
  });
});

const CHAMPION: ReferenceChampion = {
  tier: 'advanced',
  seed: 2,
  generation: 40,
  rating: 1600,
  hider: { inputs: STANDARD_HIDESEEK_INPUTS, genome: 'U0JHMQ==' },
  seeker: { inputs: STANDARD_HIDESEEK_INPUTS, genome: 'U0JHMQ==' },
};

describe('parseReferences with champions', () => {
  it('keeps Hide and Seek champions and rejects broken ones', () => {
    const file = { ...SAMPLE, env: 'hideseek' as const, champions: [CHAMPION] };
    expect(parseReferences(JSON.parse(JSON.stringify(file)))).toEqual(file);
    expect(parseReferences({ ...file, champions: [{ ...CHAMPION, rating: 'high' }] })).toBeNull();
    expect(parseReferences({ ...file, champions: [{ ...CHAMPION, hider: { inputs: {}, genome: 'x' } }] })).toBeNull();
    expect(parseReferences({ ...file, champions: 'none' })).toBeNull();
  });
});

describe('summarizeCurve', () => {
  it('takes the median and the middle half at each checkpoint', () => {
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(quantile([], 0.5)).toBe(0);
    const curve = summarizeCurve('advanced', [0, 5], [
      [1, 10],
      [2, 20],
      [3, 30],
      [4, 40],
      [5, 50],
    ]);
    expect(curve.curve).toEqual([
      { generation: 0, median: 3, p25: 2, p75: 4 },
      { generation: 5, median: 30, p25: 20, p75: 40 },
    ]);
    expect(curve.finalScore).toBe(30);
  });

  it('pools every seed over the last checkpoints for the final score', () => {
    const scores = [
      [0, 10, 60],
      [0, 20, 10],
      [0, 70, 20],
    ];
    // The last checkpoint alone (60, 10, 20) has median 20, and so do the last two pooled (10, 60, 20, 10, 70, 20).
    expect(summarizeCurve('beginner', [0, 10, 20], scores).finalScore).toBe(20);
    expect(summarizeCurve('beginner', [0, 10, 20], scores, 2).finalScore).toBe(20);
    expect(summarizeCurve('beginner', [0, 10, 20], [[0, 40, 50]], 2).finalScore).toBe(45);
    expect(summarizeCurve('beginner', [0, 10, 20], [[0, 40, 50]], 9).finalScore).toBe(40);
  });
});

describe('loadReferences', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the racing file and parses it', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(SAMPLE)));
    vi.stubGlobal('fetch', fetch);
    expect(await loadReferences('racing')).toEqual(SAMPLE);
    expect(fetch).toHaveBeenCalledWith('/references/racing.json');
  });

  it('returns null when the file is missing, broken or for another env', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    expect(await loadReferences('racing')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{ not json')));
    expect(await loadReferences('racing')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));
    expect(await loadReferences('racing')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SAMPLE))));
    expect(await loadReferences('hideseek')).toBeNull();
  });

  it('fetches the Hide and Seek file from its own path', async () => {
    const file = { ...SAMPLE, env: 'hideseek', champions: [CHAMPION] };
    const fetch = vi.fn(async () => new Response(JSON.stringify(file)));
    vi.stubGlobal('fetch', fetch);
    expect(await loadReferences('hideseek')).toEqual(file);
    expect(fetch).toHaveBeenCalledWith('/references/hideseek.json');
  });
});
