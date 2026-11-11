import { BLUEPRINT_SCHEMA_VERSION, type EpisodeBlueprint } from '../blueprints/types';
import { FULL_DRIVING_INPUTS, STANDARD_DRIVING_INPUTS, type DrivingInputConfig } from './sensors/inputConfig';

/** A Driving brain: the shared blueprint fields plus the Driving sensor groups. */
export type DrivingBlueprint = EpisodeBlueprint<'driving', DrivingInputConfig>;

/**
 * Gentler weight changes than the textbook NEAT defaults (see
 * neatDefaults.ts): a driving brain has fifty or so weights that must all
 * stay roughly right at once. Every preset carries them, so a run built
 * from any of them trains the way the curriculum was tuned.
 */
const neat = { mutation: { replaceWeight: 0.02, weightPower: 0.3 } };
const base = { schemaVersion: BLUEPRINT_SCHEMA_VERSION, readonly: true, activation: 'tanh', wiring: 'direct', env: 'driving', neat } as const;

/** The Driving preset brains, from quiet streets to the whole city. */
export const DRIVING_BLUEPRINTS: DrivingBlueprint[] = [
  {
    ...base,
    id: 'driving-starter',
    name: 'Driving Starter',
    tier: 'starter',
    description: 'Five lidar beams, the lane, the route, the light ahead and speed. 17 inputs.',
    teaches: 'Lanes, turns and red lights on quiet streets.',
    inputs: { ...STANDARD_DRIVING_INPUTS, lidar: { ...STANDARD_DRIVING_INPUTS.lidar, count: 5 }, carAhead: false, pedestrian: false },
  },
  {
    ...base,
    id: 'driving-standard',
    name: 'Driving Standard',
    tier: 'standard',
    description: 'Nine lidar beams plus every road sensor: lane, route, light, the car ahead, people and speed. 25 inputs.',
    teaches: 'The whole city: lights, people and traffic.',
    inputs: STANDARD_DRIVING_INPUTS,
  },
  {
    ...base,
    id: 'driving-advanced',
    name: 'Driving Advanced',
    tier: 'advanced',
    description: 'Fifteen lidar beams that also say what they hit, plus every road sensor. 46 inputs.',
    teaches: 'Telling a parked car from a person crossing at rush hour.',
    inputs: FULL_DRIVING_INPUTS,
  },
];

/** The brain a new run starts on unless the user picks another. */
export const DEFAULT_DRIVING_BLUEPRINT = DRIVING_BLUEPRINTS[1];
