import { STANDARD_HIDESEEK_INPUTS } from '../hideseek/inputConfig';
import { STANDARD_RACING_INPUTS } from '../racing/sensors/inputConfig';
import { BLUEPRINT_SCHEMA_VERSION, type Blueprint, type HideSeekBlueprint, type RacingBlueprint } from './types';

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

export const HIDESEEK_BLUEPRINTS: HideSeekBlueprint[] = [
  {
    ...base,
    id: 'hideseek-starter',
    name: 'Hide and Seek Starter',
    env: 'hideseek',
    tier: 'starter',
    description: 'Eight distance rays, speed, opponent visible, phase and the nearest ramp. 17 inputs.',
    teaches: 'Hiding and seeking without boxes.',
    inputs: {
      ...STANDARD_HIDESEEK_INPUTS,
      rays: { count: 8, range: 12, hitTypes: false },
      speed: true,
      velocity: false,
      holding: false,
      time: false,
      opponentLastSeen: false,
    },
  },
  {
    ...base,
    id: 'hideseek-standard',
    name: 'Hide and Seek Standard',
    env: 'hideseek',
    tier: 'standard',
    description: 'Sixteen rays with hit types, velocity, holding, phase, time, opponent and the nearest ramp. 61 inputs.',
    teaches: 'Box building, shelters and ramps.',
    inputs: STANDARD_HIDESEEK_INPUTS,
  },
  {
    ...base,
    id: 'hideseek-advanced',
    name: 'Hide and Seek Advanced',
    env: 'hideseek',
    tier: 'advanced',
    description: 'Standard plus position and lock state of the two nearest crates. 69 inputs.',
    teaches: 'Faster shelter discovery.',
    inputs: { ...STANDARD_HIDESEEK_INPUTS, nearestBoxes: 2 },
  },
];

export const PRESET_BLUEPRINTS: Blueprint[] = [...RACING_BLUEPRINTS, ...HIDESEEK_BLUEPRINTS];

export function findPresetBlueprint(id: string): Blueprint | undefined {
  return PRESET_BLUEPRINTS.find((b) => b.id === id);
}
