import { DRIVING_ADVANCED } from './drivingAdvanced';
import { DRIVING_BEGINNER } from './drivingBeginner';
import { DRIVING_INTERMEDIATE } from './drivingIntermediate';
import type { ScriptPreset } from './types';

/** The Driving scripts in the picker, one per tier. Like the others they are read only. */
export const DRIVING_PRESETS: readonly ScriptPreset[] = [
  {
    id: 'driving-beginner',
    name: 'Beginner',
    tier: 'beginner',
    env: 'driving',
    description: 'Points for progress and for arriving, with a small brain. Nothing punishes a red light, so it learns to stop for one only once cross traffic arrives.',
    source: DRIVING_BEGINNER,
  },
  {
    id: 'driving-intermediate',
    name: 'Intermediate',
    tier: 'intermediate',
    env: 'driving',
    description: 'The built-in reward written out: progress, arriving, and costs for every broken rule. Runs exactly like a run without a script.',
    source: DRIVING_INTERMEDIATE,
  },
  {
    id: 'driving-advanced',
    name: 'Advanced',
    tier: 'advanced',
    env: 'driving',
    description: 'The built-in reward plus care around people and cars, and new random cities once the lights are learned.',
    source: DRIVING_ADVANCED,
  },
];
