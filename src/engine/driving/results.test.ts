import { describe, expect, it } from 'vitest';
import { createLearner, stopLearner } from './agent/learner';
import { cityFor } from './city/buildCity';
import { builtInCity, DEFAULT_CITY_ID } from './city/presets';
import { buildRoute } from './route/route';
import { resultOf } from './results';
import { createDrivingSetup } from './setup';

const city = cityFor(builtInCity(DEFAULT_CITY_ID)!);
const spec = createDrivingSetup({ level: 2, seed: 4 }).route;
const route = buildRoute(city, spec.elements, spec.startS, spec.destS);

describe('resultOf', () => {
  it('calls the whole route covered on an arrival a few meters short of the zone middle', () => {
    const l = createLearner(0, route, 0);
    l.maxProgress = route.destS - 5;
    stopLearner(l, 'arrived');
    expect(resultOf(l, route.startS, route.destS).completion).toBe(1);
  });

  it('gives the share covered on a trip that did not arrive', () => {
    const l = createLearner(0, route, 0);
    l.maxProgress = route.startS + (route.destS - route.startS) / 2;
    stopLearner(l, 'stuck');
    expect(resultOf(l, route.startS, route.destS).completion).toBeCloseTo(0.5);
  });
});
