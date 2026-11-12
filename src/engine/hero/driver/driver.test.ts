import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STATUS_ARRIVED, STATUS_DRIVING } from '../../driving/agent/learner';
import { parseHeroDriver } from './file';
import { carAtCamera } from './camera';
import { brokenRule } from './judge';
import { HeroDriveLoop } from './loop';
import { parkedClash } from './parked';

const shipped = () => JSON.parse(readFileSync('public/hero/driver.json', 'utf8')) as Record<string, unknown>;
/** Simulated time the loop is watched for at least, s. */
const WATCH_SECONDS = 6 * 60;

describe('the hero driver file', () => {
  it('parses the shipped SUV and its trips', () => {
    const driver = parseHeroDriver(shipped());
    expect(driver).not.toBeNull();
    expect(driver!.trips.length).toBeGreaterThanOrEqual(3);
  });

  it('turns away a stale, foreign or broken file', () => {
    const file = shipped();
    expect(parseHeroDriver({ ...file, engineVersion: -1 })).toBeNull();
    expect(parseHeroDriver({ ...file, version: 99 })).toBeNull();
    expect(parseHeroDriver({ ...file, city: 'nowhere' })).toBeNull();
    expect(parseHeroDriver({ ...file, trips: [] })).toBeNull();
    expect(parseHeroDriver({ ...file, opening: 0 })).toBeNull();
    expect(parseHeroDriver({ ...file, genome: 'bm90IGEgZ2Vub21l' })).toBeNull();
    expect(parseHeroDriver(null)).toBeNull();
  });
});

describe('the hero drive loop', () => {
  it('never crashes, runs a red, hits a person or lets traffic through it, and arrives on every trip, for minutes on end', () => {
    const driver = parseHeroDriver(shipped());
    if (!driver) throw new Error('The shipped hero driver did not parse.');
    const loop = new HeroDriveLoop(driver, driver.file.opening);
    const least = Math.round(WATCH_SECONDS * 30);
    const most = least * 6;
    let arrivals = 0;
    let episode = loop.episode;
    let wasDriving = true;
    // Watched for minutes, and on until it has gone round the whole loop twice.
    for (let t = 0; t < least || arrivals < driver.trips.length * 2; t++) {
      if (t > most) throw new Error('The loop never came round twice.');
      // The page draws up to a tick behind the latest, so the frame on screen is a tick older at worst.
      const before = loop.clock.darkness(-1);
      loop.step();
      if (loop.episode !== episode) {
        // A new trip only ever goes in behind a fully dark frame.
        expect(before).toBe(1);
        episode = loop.episode;
        wasDriving = true;
        continue;
      }
      const l = loop.learner;
      if (wasDriving) {
        const broke = brokenRule(l) ?? (carAtCamera(loop.env) ? 'had a car at the camera' : null);
        if (broke) throw new Error(`Trip ${loop.trip} ${broke} at ${l.time.toFixed(1)} s.`);
      } else if (loop.clock.darkness(-1) < 1) {
        // Parked at its destination and still on screen: the city must not run through it or the lens.
        const clash = parkedClash(loop.env);
        if (clash) throw new Error(`Trip ${loop.trip} ${clash}.`);
      }
      if (wasDriving && l.status !== STATUS_DRIVING) {
        expect(l.status, `trip ${loop.trip} stopped: ${l.stopReason}`).toBe(STATUS_ARRIVED);
        expect(l.redLightRuns).toBe(0);
        arrivals++;
      }
      wasDriving = l.status === STATUS_DRIVING;
    }
    expect(arrivals).toBeGreaterThanOrEqual(driver.trips.length * 2);
  }, 120_000);

  it('drives the same trip the same way every time', () => {
    const driver = parseHeroDriver(shipped())!;
    const a = new HeroDriveLoop(driver, 1);
    const b = new HeroDriveLoop(driver, 1);
    for (let t = 0; t < 600; t++) {
      a.step();
      b.step();
    }
    expect(a.learner.car.x).toBe(b.learner.car.x);
    expect(a.learner.car.y).toBe(b.learner.car.y);
  });
});
