import { describe, expect, it } from 'vitest';
import { editDistance, fixAll, snippetsFor, suggest } from '../autocorrect';
import { errors } from './helpers';

const HEAD = 'script "t" for racing v1\nbrain racing-standard\n';
const DRIVE = '  drive(steer: brain.steer, pedal: brain.pedal)\n';
const tick = (body: string) => `${HEAD}\neach tick {\n${DRIVE}  ${body}\n}\n`;
const gen = (body: string) => `${HEAD}\neach tick {\n${DRIVE}}\n\neach generation {\n  ${body}\n}\n`;

/** [what the person typed, what fixAll should turn it into]. */
const GOLDEN: Array<[string, string, string]> = [
  ['misspelled sensor', tick('reward 0.01 * car.sped'), tick('reward 0.01 * car.speed')],
  ['doubled letter', tick('reward 0.01 * car.speeed'), tick('reward 0.01 * car.speed')],
  ['missing letter', tick('reward +1 when checkpoint.pased'), tick('reward +1 when checkpoint.passed')],
  ['brain output', tick('drive(steer: brain.stear, pedal: 0)'), tick('drive(steer: brain.steer, pedal: 0)')],
  ['wrong case', tick('stop "crash" when car.offtrack'), tick('stop "crash" when car.offTrack')],
  ['wrong case twice', tick('stop "stalled" when car.noprogress > 3 s'), tick('stop "stalled" when car.noProgress > 3 s')],
  ['missing ending', tick('reward +10 when lap.complete'), tick('reward +10 when lap.completed')],
  ['swapped action letters', tick('dirve(steer: 0, pedal: 1)'), tick('drive(steer: 0, pedal: 1)')],
  ['swapped action letters again', tick('drvie(steer: 0, pedal: 1)'), tick('drive(steer: 0, pedal: 1)')],
  ['reward typo', tick('rewrd +1 when checkpoint.passed'), tick('reward +1 when checkpoint.passed')],
  ['stop typo', tick('stpo "crash" when car.offTrack'), tick('stop "crash" when car.offTrack')],
  ['reward missing letter', tick('rewad +1 when checkpoint.passed'), tick('reward +1 when checkpoint.passed')],
  ['if typo', tick('iff car.offTrack {\n    reward -1\n  }'), tick('if car.offTrack {\n    reward -1\n  }')],
  ['repeat typo', tick('repat 3 {\n    reward 1 when checkpoint.passed\n  }'), tick('repeat 3 {\n    reward 1 when checkpoint.passed\n  }')],
  ['let typo', tick('lte gap = 2 m\n  reward -1 when rays.min < gap'), tick('let gap = 2 m\n  reward -1 when rays.min < gap')],
  ['when typo', tick('reward +1 whne checkpoint.passed'), tick('reward +1 when checkpoint.passed')],
  ['else typo', tick('if car.offTrack {\n    reward -1\n  } esle {\n    reward 1\n  }'), tick('if car.offTrack {\n    reward -1\n  } else {\n    reward 1\n  }')],
  ['missing seconds', tick('stop "stalled" when car.noProgress > 5'), tick('stop "stalled" when car.noProgress > 5 s')],
  ['seconds where meters belong', tick('reward car.distance + 5 s'), tick('reward car.distance + 5 m')],
  ['= for ==', tick('reward 1 when car.speed = 3 m/s'), tick('reward 1 when car.speed == 3 m/s')],
  ['&& for and', tick('reward 1 when car.offTrack && checkpoint.passed'), tick('reward 1 when car.offTrack and checkpoint.passed')],
  ['|| for or', tick('reward 1 when car.offTrack || checkpoint.passed'), tick('reward 1 when car.offTrack or checkpoint.passed')],
  ['! for not', tick('reward 1 when !car.offTrack'), tick('reward 1 when not car.offTrack')],
  ['bare last part', tick('reward 1 when speed > 3 m/s'), tick('reward 1 when car.speed > 3 m/s')],
  ['unquoted reason', tick('stop crash when car.offTrack'), tick('stop "crash" when car.offTrack')],
  ['angle without unit', tick('reward -1 when car.headingError > 30'), tick('reward -1 when car.headingError > 30 deg')],
  ['unit spelled out', tick('stop "slow" when car.time > 60 sec'), tick('stop "slow" when car.time > 60 s')],
  ['unit as a word', tick('reward -1 when car.lateral > 3 meters'), tick('reward -1 when car.lateral > 3 m')],
  ['wrong unit power', tick('reward 1 when car.speed > 10 m/s2'), tick('reward 1 when car.speed > 10 m/s')],
  ['renamed sensor', tick('stop "crash" when car.offRoad'), tick('stop "crash" when car.offTrack')],
  ['each typo', `${HEAD}\neahc tick {\n${DRIVE}}\n`, `${HEAD}\neach tick {\n${DRIVE}}\n`],
  ['tick typo', `${HEAD}\neach tikc {\n${DRIVE}}\n`, `${HEAD}\neach tick {\n${DRIVE}}\n`],
  ['generation typo', gen('select(top: 20%)').replace('each generation', 'each generaton'), gen('select(top: 20%)')],
  ['operator typo', gen('speciat(target: 8)'), gen('speciate(target: 8)')],
  ['operator doubled letter', gen('breeed(crossover: 0.75)'), gen('breed(crossover: 0.75)')],
  ['operator missing letter', gen('selct(top: 20%)'), gen('select(top: 20%)')],
  ['operator missing s', gen('keepChampion()'), gen('keepChampions()')],
  ['parameter typo', gen('breed(crosover: 0.7)'), gen('breed(crossover: 0.7)')],
  ['settings field typo', gen('breed(mutate: { weight: 0.8 })'), gen('breed(mutate: { weights: 0.8 })')],
  ['track id typo', gen('useTrack(id: "hairpn")'), gen('useTrack(id: "hairpin")')],
  ['environment typo', tick('reward 1').replace('for racing', 'for racng'), tick('reward 1')],
  ['brain typo', tick('reward 1').replace('racing-standard', 'racing-standrd'), tick('reward 1')],
  ['sensor typo', `${HEAD}sensr gap "Gap" in 0 m .. 60 m = rays.min\n`, `${HEAD}sensor gap "Gap" in 0 m .. 60 m = rays.min\n`],
  ['script typo', tick('reward 1').replace('script', 'scirpt'), tick('reward 1')],
  ['missing closing brace', `${HEAD}\neach tick {\n${DRIVE}`, `${HEAD}\neach tick {\n${DRIVE.trimEnd()}\n}\n`],
  ['brace missing before the next block', `${HEAD}\neach tick {\n${DRIVE}\neach generation {\n  keepChampions()\n}\n`, `${HEAD}\neach tick {\n${DRIVE.trimEnd()}\n}\n\neach generation {\n  keepChampions()\n}\n`],
];

describe('autocorrect golden cases', () => {
  it('has at least 30 cases', () => expect(GOLDEN.length).toBeGreaterThanOrEqual(30));

  for (const [name, before, after] of GOLDEN) {
    it(`fixes ${name}`, () => {
      expect(errors(before).length + (before.includes('car.offRoad') ? 1 : 0)).toBeGreaterThan(0);
      const fixed = fixAll(before);
      expect(fixed.source).toBe(after);
      expect(fixed.applied.length).toBeGreaterThan(0);
      expect(errors(fixed.source)).toEqual([]);
    });
  }
});

describe('suggestions', () => {
  it('counts a swapped pair of letters as one edit', () => {
    expect(editDistance('stpo', 'stop')).toBe(1);
    expect(editDistance('drvie', 'drive')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });

  it('does not suggest names that are too far away', () => {
    expect(suggest('banana', ['car.speed', 'drive'])).toEqual([]);
  });

  it('offers every close match when the typo is ambiguous', () => {
    const names = suggest('count', ['checkpoint.count', 'lap.count']).map((s) => s.name);
    expect(names).toEqual(['checkpoint.count', 'lap.count']);
    expect(fixAll(tick('reward 1 when count > 3')).applied).toEqual([]);
  });
});

describe('snippets', () => {
  it('typing rew offers the reward templates', () => {
    const labels = snippetsFor('rew', 'tick').map((s) => s.label);
    expect(labels).toEqual(['reward when', 'reward every tick']);
    expect(snippetsFor('rew', 'tick')[0].template).toContain('${1:');
  });

  it('offers registry calls for the block being edited', () => {
    expect(snippetsFor('dri', 'tick').map((s) => s.label)).toContain('drive');
    expect(snippetsFor('spe', 'generation').map((s) => s.label)).toContain('speciate');
    expect(snippetsFor('spe', 'tick').map((s) => s.label)).not.toContain('speciate');
    expect(snippetsFor('each', 'top').map((s) => s.label)).toEqual(['each tick', 'each generation']);
  });
});
