import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import type { HideSeekLayoutId } from '../layouts/types';
import { runMatch } from '../match/runMatch';
import type { MatchSpec } from '../match/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '../physics';
import { scriptedHiderController } from '../scriptedHider';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { FACE_NORTH, FACE_SOUTH, idle, NO_PREP, placedMatch, randomGenomes, scriptedMatch } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

type Seeker = [number, number, number];
type Hider = [number, number];

/** Exposure flags after one seek tick of a hand placed match. */
function afterOneTick(layout: HideSeekLayoutId, seeker: Seeker, hider: Hider) {
  const m = placedMatch(pool, layout, seeker, hider);
  m.step();
  const out = { seen: m.hider.seen, hidden: m.hider.hidden, exposed: m.hider.exposed, seekerView: m.seeker.exposed };
  m.release();
  return out;
}

describe('exposure', () => {
  it('a seeker looking the other way leaves the hider hidden but exposed', () => {
    expect(afterOneTick('open', [0, 3, FACE_SOUTH], [0, -3])).toEqual({ seen: false, hidden: true, exposed: true, seekerView: true });
  });

  it('a wall in between or being out of range is real cover', () => {
    expect(afterOneTick('corridor', [2, 2.5, FACE_NORTH], [2, -2.5]).exposed).toBe(false);
    expect(afterOneTick('open', [0, 7.5, FACE_NORTH], [0, -7.5]).exposed).toBe(false);
  });

  it('a hider in sight is always exposed', () => {
    expect(afterOneTick('open', [0, 3, FACE_NORTH], [0, -3])).toEqual({ seen: true, hidden: false, exposed: true, seekerView: true });
  });
});

describe('cover rewards', () => {
  const p = DEFAULT_HIDESEEK_PHYSICS;
  const SEEK_SECONDS = p.matchSeconds * (1 - p.prepShare);

  function play(layout: HideSeekLayoutId, seeker: Seeker) {
    const m = placedMatch(pool, layout, seeker, [seeker[0], -seeker[1]], p, 'cover');
    const result = m.run();
    m.release();
    return result;
  }

  it('pays hiders +1/s in cover and seekers the opposite', () => {
    const r = play('corridor', [2, 2.5, FACE_NORTH]);
    expect(r.exposedShare).toBe(0);
    expect(r.hiderReward).toBeCloseTo(SEEK_SECONDS, 9);
    expect(r.seekerReward).toBeCloseTo(-SEEK_SECONDS, 9);
  });

  it('pays nothing while the hider is only out of view', () => {
    const r = play('open', [0, 3, FACE_SOUTH]);
    expect(r.hiddenShare).toBe(1);
    expect(r.exposedShare).toBe(1);
    expect([r.hiderReward, r.seekerReward]).toEqual([0, 0]);
  });

  it('charges hiders -1/s while seen', () => {
    const r = play('open', [0, 3, FACE_NORTH]);
    expect(r.hiderReward).toBeCloseTo(-SEEK_SECONDS, 9);
    expect(r.seekerReward).toBeCloseTo(SEEK_SECONDS, 9);
  });
});

describe('scripted hider', () => {
  it('runs from a seeker it can see', () => {
    const m = scriptedMatch(pool, 'open', scriptedHiderController, idle(), NO_PREP);
    m.moveAgent('seeker', 0, 3, FACE_NORTH);
    m.moveAgent('hider', 0, -3, FACE_SOUTH);
    for (let t = 0; t < 60; t++) m.step();
    expect(m.hider.opponentDistance).toBeGreaterThan(7);
    m.release();
  });

  it('is found far less often by random seekers than by the scripted seeker', () => {
    const inputs = STANDARD_HIDESEEK_INPUTS;
    const hiders = randomGenomes(inputs, 18, 71);
    const seekers = randomGenomes(inputs, 18, 72);
    const specs: MatchSpec[] = seekers.map((s, i) => ({
      layout: (['open', 'shelter', 'corridor'] as const)[i % 3],
      seed: 700 + i,
      hider: { genome: hiders[i], inputs, scripted: true },
      seeker: { genome: s, inputs },
    }));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const vsRandom = mean(specs.map((s) => runMatch(s, pool).seenShare));
    const vsScripted = mean(specs.map((s) => runMatch({ ...s, seeker: { ...s.seeker, scripted: true } }, pool).seenShare));
    expect(vsScripted).toBeGreaterThan(vsRandom + 0.1);
  });
});
