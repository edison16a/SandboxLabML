import { STANDARD_RACING_INPUTS } from '../racing/sensors/inputConfig';
import { BLUEPRINT_SCHEMA_VERSION, type RacingBlueprint } from './types';

/**
 * The Racing preset brains, from the one meant to fail to the one that
 * reads the grip limit. They live apart from the other presets so the
 * Racing env module can list them without importing every env's presets.
 */
const base = { schemaVersion: BLUEPRINT_SCHEMA_VERSION, readonly: true, activation: 'tanh', wiring: 'direct' } as const;
const noScalars = { speed: false, headingError: false, steerAngle: false, curvatureNear: false, curvatureFar: false, slip: false };

export const RACING_BLUEPRINTS: RacingBlueprint[] = [
  {
    ...base,
    id: 'racing-tiny',
    name: 'Racing Tiny',
    env: 'racing',
    tier: 'tiny',
    description: 'Distance ahead and speed. 2 inputs.',
    teaches: 'Why a car with no side vision cannot steer. This one is meant to fail.',
    inputs: { ...STANDARD_RACING_INPUTS, ...noScalars, rays: { count: 1, fov: 0, range: 60 }, speed: true },
  },
  {
    ...base,
    id: 'racing-starter',
    name: 'Racing Starter',
    env: 'racing',
    tier: 'starter',
    description: 'Three rays (left, ahead, right) and speed. 4 inputs.',
    teaches: 'Simple driving with the fewest sensors that work.',
    inputs: { ...STANDARD_RACING_INPUTS, ...noScalars, rays: { count: 3, fov: Math.PI / 2, range: 60 }, speed: true },
  },
  {
    ...base,
    id: 'racing-standard',
    name: 'Racing Standard',
    env: 'racing',
    tier: 'standard',
    description: 'Nine rays, speed and heading error. 11 inputs.',
    teaches: 'Reliable laps on every built-in track.',
    inputs: STANDARD_RACING_INPUTS,
  },
  {
    ...base,
    id: 'racing-advanced',
    name: 'Racing Advanced',
    env: 'racing',
    tier: 'advanced',
    description: 'Standard plus steering angle, curvature 15 m and 40 m ahead, and lateral slip. 15 inputs.',
    teaches: 'Braking points and how close to drive to the grip limit.',
    inputs: { ...STANDARD_RACING_INPUTS, steerAngle: true, curvatureNear: true, curvatureFar: true, slip: true },
  },
];
