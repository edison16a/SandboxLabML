import { mixSeed } from '../core/rng';
import type { AgentController } from '../env/types';
import type { DrivingLearner } from './agent/learner';
import { cityFor } from './city/buildCity';
import { builtInCity, DEFAULT_CITY_ID } from './city/presets';
import type { City, CitySpec } from './city/types';
import type { DrivingEnvOptions } from './env';
import { drivingLevel, timeLimit, type DrivingLevel } from './levels';
import { DEFAULT_ROUTE, pickRoute, type RouteOptions, type RouteSpec } from './route/planner';
import { buildRoute, type Route } from './route/route';
import type { CarParams } from './car/params';
import type { DrivingInputConfig } from './sensors/inputConfig';
import type { CustomSensorSpec } from './sensors/inputSchema';

/**
 * Everything one episode needs, as plain data a worker can rebuild: the
 * city, the level, the trip and the seed of the city's life. A generation
 * builds one and every learner drives it; the next generation gets a new
 * trip from a new seed.
 */
export interface DrivingSetup {
  city: CitySpec;
  level: number;
  route: RouteSpec;
  worldSeed: number;
  /** Episode length, s. */
  maxTime: number;
}

export interface DrivingSetupOptions {
  /** Defaults to Midtown. */
  city?: CitySpec;
  level: number;
  /** Picks the trip and seeds the world: mix the run seed and the generation into it. */
  seed: number;
  route?: RouteOptions;
}

export function createDrivingSetup(opts: DrivingSetupOptions): DrivingSetup {
  const spec = opts.city ?? builtInCity(DEFAULT_CITY_ID)!;
  const city = cityFor(spec);
  const route = pickRoute(city, mixSeed(opts.seed, 0x40), opts.route ?? DEFAULT_ROUTE);
  const built = buildRoute(city, route.elements, route.startS, route.destS);
  return { city: spec, level: opts.level, route, worldSeed: mixSeed(opts.seed, 0x77), maxTime: timeLimit(built.length, built.stops.length) };
}

/** A setup's city, route and level, built (the city is cached by spec). */
export interface DrivingWorld {
  city: City;
  route: Route;
  level: DrivingLevel;
}

export function buildDrivingWorld(setup: DrivingSetup): DrivingWorld {
  const city = cityFor(setup.city);
  return { city, route: buildRoute(city, setup.route.elements, setup.route.startS, setup.route.destS), level: drivingLevel(setup.level) };
}

/** Env options for a setup: the built world plus the run's car, inputs and controller. */
export function drivingEnvOptions(
  setup: DrivingSetup,
  car: CarParams,
  inputs: DrivingInputConfig,
  controller: AgentController<DrivingLearner>,
  extra: { customSensors?: CustomSensorSpec[]; lesion?: DrivingEnvOptions['lesion'] } = {},
): DrivingEnvOptions {
  const world = buildDrivingWorld(setup);
  return { ...world, car, inputs, controller, maxTime: setup.maxTime, worldSeed: setup.worldSeed, ...extra };
}
