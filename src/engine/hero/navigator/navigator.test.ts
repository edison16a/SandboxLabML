import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NAV_FINISHED, NAV_RUNNING } from '../../navigation/agent';
import { parseHeroNavigator } from './file';
import { HeroRunLoop } from './loop';

const shipped = () => JSON.parse(readFileSync('public/hero/navigator.json', 'utf8')) as Record<string, unknown>;
/** Simulated time the loop is watched for at least, s. */
const WATCH_SECONDS = 5 * 60;

describe('the hero runner file', () => {
  it('parses the shipped runner and its courses', () => {
    const navigator = parseHeroNavigator(shipped());
    expect(navigator).not.toBeNull();
    expect(navigator!.courses.length).toBeGreaterThanOrEqual(3);
  });

  it('turns away a stale or broken file', () => {
    const file = shipped();
    expect(parseHeroNavigator({ ...file, engineVersion: -1 })).toBeNull();
    expect(parseHeroNavigator({ ...file, version: 99 })).toBeNull();
    expect(parseHeroNavigator({ ...file, courses: [] })).toBeNull();
    expect(parseHeroNavigator({ ...file, courses: [{ slot: 0, seed: 1 }] })).toBeNull();
    expect(parseHeroNavigator({ ...file, genome: 'bm90IGEgZ2Vub21l' })).toBeNull();
    expect(parseHeroNavigator(null)).toBeNull();
  });
});

describe('the hero run loop', () => {
  it('crosses the finish line on every course and never dies, for minutes on end', () => {
    const navigator = parseHeroNavigator(shipped());
    if (!navigator) throw new Error('The shipped hero runner did not parse.');
    const loop = new HeroRunLoop(navigator, navigator.file.opening);
    const least = Math.round(WATCH_SECONDS * 30);
    const most = least * 6;
    let finishes = 0;
    let episode = loop.episode;
    let running = true;
    // Watched for minutes, and on until it has gone round the whole loop twice.
    for (let t = 0; t < least || finishes < navigator.courses.length * 2; t++) {
      if (t > most) throw new Error('The loop never came round twice.');
      // The page draws up to a tick behind the latest, so the frame on screen is a tick older at worst.
      const before = loop.clock.darkness(-1);
      loop.step();
      if (loop.episode !== episode) {
        // A new course only ever goes in behind a fully dark frame.
        expect(before).toBe(1);
        episode = loop.episode;
        running = true;
        continue;
      }
      const a = loop.agent;
      if (running && a.status !== NAV_RUNNING) {
        expect(a.status, `${loop.course.spec.name} ended: ${a.stopReason}`).toBe(NAV_FINISHED);
        finishes++;
      }
      running = a.status === NAV_RUNNING;
    }
    expect(finishes).toBeGreaterThanOrEqual(navigator.courses.length * 2);
  }, 60_000);
});
