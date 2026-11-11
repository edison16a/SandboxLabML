import { builtInCity, DEFAULT_CITY_ID, randomCitySpec } from '../city/presets';
import type { CitySpec } from '../city/types';
import { MAX_LEVEL, MIN_LEVEL } from '../levels';
import type { RunConfig } from '../../training/runConfig';

/** Trips a generation may drive. Each one is a whole drive for every brain, so more is steadier but slower. */
export const MIN_TRIPS = 1;
export const MAX_TRIPS = 4;

/**
 * A Driving run's own options, stored as the run config's `settings` and
 * frozen with it. They only say where the run starts: the script's
 * generation block and the automatic curriculum move the live content
 * (see content.ts) from there.
 */
export interface DrivingSettings {
  /** A built in city id, or `random-<seed>` for a generated one. */
  city: string;
  /** The level the first generation drives, 1 to 5. */
  level: number;
  /** Move up a level on its own once enough of the population arrives safely. */
  auto: boolean;
  /** Trips per generation (routesPerGeneration in a script). */
  trips: number;
}

/**
 * Three trips per generation: a brain then has to handle turns and
 * straight runs in the same generation, so its score swings less with the
 * luck of one route and the curriculum moves on real skill. Headless runs
 * reached traffic lights in about the same number of generations with two,
 * and needed a third fewer generations for people with three.
 */
export const DEFAULT_DRIVING_SETTINGS: DrivingSettings = { city: DEFAULT_CITY_ID, level: MIN_LEVEL, auto: true, trips: 3 };

export function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(Number.isFinite(level) ? level : MIN_LEVEL)));
}

export function clampTrips(trips: number): number {
  return Math.min(MAX_TRIPS, Math.max(MIN_TRIPS, Math.round(Number.isFinite(trips) ? trips : MIN_TRIPS)));
}

/** The id of the generated city for a seed. */
export function randomCityId(seed: number): string {
  return `random-${Math.floor(Math.abs(seed)) >>> 0}`;
}

/** A city id as a spec: a built in city, a generated one, or Midtown for an id this build does not know. */
export function cityOf(id: string): CitySpec {
  const match = /^random-(\d+)$/.exec(id);
  if (match) return randomCitySpec(Number(match[1]));
  return builtInCity(id) ?? builtInCity(DEFAULT_CITY_ID)!;
}

/** True for ids cityOf resolves to themselves, so a directive naming a city that does not exist is ignored. */
export function isCityId(id: string): boolean {
  return /^random-\d+$/.test(id) || builtInCity(id) !== undefined;
}

/** A Driving run's settings, with anything missing or out of range set to its default. */
export function drivingSettingsOf(config: RunConfig): DrivingSettings {
  const s = (config.settings ?? {}) as Partial<DrivingSettings>;
  return {
    city: typeof s.city === 'string' && isCityId(s.city) ? s.city : DEFAULT_DRIVING_SETTINGS.city,
    level: clampLevel(s.level ?? DEFAULT_DRIVING_SETTINGS.level),
    auto: s.auto ?? DEFAULT_DRIVING_SETTINGS.auto,
    trips: clampTrips(s.trips ?? DEFAULT_DRIVING_SETTINGS.trips),
  };
}
