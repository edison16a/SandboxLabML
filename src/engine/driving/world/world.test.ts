import { describe, expect, it } from 'vitest';
import { buildCity } from '../city/buildCity';
import { BUILT_IN_CITIES } from '../city/presets';
import { isOnRoad } from '../city/surface';
import { ELEMENT_LANE } from '../city/types';
import { drivingLevel } from '../levels';
import { axisOf, LIGHT_RED, lightState, WALK_DONT, walkState } from '../signals/plan';
import { CityWorld } from './cityWorld';
import { PED_CROSS, PED_WAIT, PED_WALK } from './state';

const city = buildCity(BUILT_IN_CITIES[0]);
const DT = 1 / 30;

describe('city world', () => {
  it('is the same from the same seed', () => {
    const a = new CityWorld(city, drivingLevel(5));
    const b = new CityWorld(city, drivingLevel(5));
    a.reset(11, null);
    b.reset(11, null);
    for (let t = 0; t < 600; t++) {
      a.step(DT);
      b.step(DT);
    }
    expect(Array.from(a.state.carX.slice(0, a.state.carCount))).toEqual(Array.from(b.state.carX.slice(0, b.state.carCount)));
    expect(Array.from(a.state.pedY.slice(0, a.state.pedCount))).toEqual(Array.from(b.state.pedY.slice(0, b.state.pedCount)));
  });

  it('populates each level as its profile says', () => {
    for (let id = 1; id <= 5; id++) {
      const level = drivingLevel(id);
      const w = new CityWorld(city, level);
      w.reset(3, null);
      expect(w.state.carCount).toBe(level.traffic);
      expect(w.state.pedCount).toBe(level.pedestrians);
      expect(w.state.signalsOn).toBe(level.signals);
    }
  });

  it('keeps people on sidewalks except on crossings, and starts crossings only on the walk signal', () => {
    const w = new CityWorld(city, drivingLevel(3));
    w.reset(7, null);
    const crowd = w.peds.crowd;
    const was = new Uint8Array(crowd.count);
    let crossings = 0;
    for (let t = 0; t < 2400; t++) {
      w.step(DT);
      for (let i = 0; i < crowd.count; i++) {
        const mode = crowd.mode[i];
        if (mode === PED_WALK) expect(isOnRoad(city, crowd.x[i], crowd.y[i])).toBe(false);
        if (mode === PED_CROSS && was[i] === PED_WAIT) {
          crossings++;
          const k = city.crosswalks[crowd.crossing[i]];
          // The world stepped people at the start of the tick, so judge the signal at that time.
          expect(walkState(w.state.time - DT, city.signalOffsets[city.nodes[k.node].signal], k.walkAxis)).not.toBe(WALK_DONT);
        }
        was[i] = mode;
      }
    }
    expect(crossings).toBeGreaterThan(10);
  });

  it('stops traffic at red lights and keeps cars apart', () => {
    const w = new CityWorld(city, drivingLevel(4));
    w.reset(5, null);
    const f = w.traffic.fleet;
    const lastEl = new Int32Array(f.count).fill(-1);
    let entries = 0;
    let moved = 0;
    for (let t = 0; t < 2400; t++) {
      const time = w.state.time;
      w.step(DT);
      for (let i = 0; i < f.count; i++) {
        const before = lastEl[i];
        const now = f.el[i];
        // A car leaving a lane that ends at a signal must not do so on red.
        if (before >= 0 && before !== now) {
          const lane = city.elements[before];
          if (lane.kind === ELEMENT_LANE && lane.stopLine && f.still[i] === 0) {
            entries++;
            const sig = city.nodes[lane.to].signal;
            expect(lightState(time, city.signalOffsets[sig], axisOf(lane.dir))).not.toBe(LIGHT_RED);
          }
        }
        lastEl[i] = now;
        moved += f.v[i] * DT;
      }
      f.index();
      // No two cars on one lane overlap.
      for (let e = 0; e < city.laneCount; e++) {
        for (let a = f.head[e]; a >= 0; a = f.link[a]) {
          for (let b = f.link[a]; b >= 0; b = f.link[b]) expect(Math.abs(f.s[a] - f.s[b])).toBeGreaterThan((f.len[a] + f.len[b]) / 2 - 0.3);
        }
      }
    }
    expect(entries).toBeGreaterThan(20);
    // Traffic flows: on average each car covers real ground.
    expect(moved / f.count).toBeGreaterThan(200);
  });
});
