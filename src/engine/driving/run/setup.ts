import { mixSeed } from '../../core/rng';
import type { EpisodeSetup, SetupInput } from '../../env/episode';
import type { DrivingInputConfig } from '../sensors/inputConfig';
import { createDrivingSetup, type DrivingSetup } from '../setup';
import type { DrivingContent } from './content';
import { drivingInputsOf } from './inputs';
import { cityOf } from './settings';

/**
 * Everything a worker needs to run one Driving generation, as plain data:
 * one DrivingSetup per trip (city, level, route, world seed, time limit),
 * the run's sensor groups and the script. Workers rebuild the cities (cached
 * by spec) and routes from it.
 */
export interface DrivingRunSetup extends EpisodeSetup {
  trips: DrivingSetup[];
  inputs: DrivingInputConfig;
}

/** The trips of a content: each one a route picked from the trip seed, in the content's city and level. */
export function contentTrips(content: DrivingContent): DrivingSetup[] {
  const city = cityOf(content.city);
  return Array.from({ length: content.trips }, (_, k) => createDrivingSetup({ city, level: content.level, seed: mixSeed(content.tripSeed, k) }));
}

export function createDrivingRunSetup({ config, content, scriptSource }: SetupInput<DrivingContent>): DrivingRunSetup {
  return { trips: contentTrips(content), inputs: drivingInputsOf(config), scriptSource };
}
