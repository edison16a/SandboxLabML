import { hashObject } from '../../core/hash';
import { mixSeed } from '../../core/rng';
import type { ContentStep } from '../../env/episode';
import type { RunConfig } from '../../training/runConfig';
import { advanceCurriculum, startCurriculum, withBar, type Curriculum } from '../curriculum';
import { clampLevel, clampTrips, drivingSettingsOf, isCityId } from './settings';
import type { DrivingRunResult } from './results';

/**
 * What a Driving population trains on right now: the city, the level, how
 * many trips each brain drives and the seed that picks them. Small plain
 * data, so every generation record keeps the content it ran on and a ghost,
 * a branch or the Sandbox can rebuild exactly that episode.
 */
export interface DrivingContent {
  /** A built in city id or `random-<seed>`. */
  city: string;
  level: number;
  /** Where the automatic curriculum stands, or null while the level is fixed. */
  curriculum: Curriculum | null;
  trips: number;
  /** Picks this generation's trips and seeds the city's life. A new one every generation. */
  tripSeed: number;
}

/** Salt of the trip seed, so the trips never line up with any other stream drawn from the run seed. */
const TRIP_SALT = 0x7219;

/** The trip seed of a generation: new routes every generation, the same ones wherever the run is rebuilt. */
export function tripSeedOf(runSeed: number, generation: number): number {
  return mixSeed(runSeed, generation, TRIP_SALT);
}

export function initialDrivingContent(config: RunConfig): DrivingContent {
  const s = drivingSettingsOf(config);
  return { city: s.city, level: s.level, curriculum: s.auto ? startCurriculum(s.level) : null, trips: s.trips, tripSeed: tripSeedOf(config.seed, 0) };
}

/**
 * The requests a script's generation block made (see the driving script
 * operators), read loosely: anything of the wrong type is ignored, as if
 * the operator had not run.
 */
export interface DrivingRequests {
  city?: string;
  level?: number;
  trips?: number;
  /** autoLevel(share): turn the automatic curriculum on, with this bar. */
  autoLevel?: number;
}

export function requestsOf(env: Record<string, unknown> | undefined): DrivingRequests {
  const r: DrivingRequests = {};
  if (!env) return r;
  if (typeof env.city === 'string' && isCityId(env.city)) r.city = env.city;
  if (typeof env.level === 'number' && Number.isFinite(env.level)) r.level = env.level;
  if (typeof env.trips === 'number' && Number.isFinite(env.trips)) r.trips = env.trips;
  if (typeof env.autoLevel === 'number' && Number.isFinite(env.autoLevel)) r.autoLevel = env.autoLevel;
  return r;
}

/**
 * The content of the next generation. A script's useLevel fixes the level
 * and turns the curriculum off; autoLevel turns it back on. Otherwise the
 * curriculum, when on, records this generation's safe share and may move
 * up. Every generation gets a new trip seed. A new level, city or trip
 * count resets the stagnation count, since old scores no longer compare.
 */
export function nextDrivingContent(step: ContentStep<DrivingContent, DrivingRunResult>): { content: DrivingContent; reset: boolean } {
  const { config, content, generation, directives, metrics } = step;
  const asked = requestsOf(directives.env);
  const city = asked.city ?? content.city;
  const trips = asked.trips !== undefined ? clampTrips(asked.trips) : content.trips;
  let level = content.level;
  let curriculum = content.curriculum;
  if (asked.level !== undefined) {
    level = clampLevel(asked.level);
    curriculum = null;
  } else {
    if (asked.autoLevel !== undefined) curriculum = curriculum ? withBar(curriculum, asked.autoLevel) : startCurriculum(level, asked.autoLevel);
    if (curriculum) {
      curriculum = advanceCurriculum(curriculum, metrics.eliteSafe ?? 0);
      level = curriculum.level;
    }
  }
  const next: DrivingContent = { city, level, curriculum, trips, tripSeed: tripSeedOf(config.seed, generation + 1) };
  return { content: next, reset: level !== content.level || city !== content.city || trips !== content.trips };
}

/** Stored on every record as its trackHash: what was driven, without the curriculum's bookkeeping. */
export function drivingContentHash(c: DrivingContent): string {
  return hashObject({ city: c.city, level: c.level, trips: c.trips, tripSeed: c.tripSeed });
}
