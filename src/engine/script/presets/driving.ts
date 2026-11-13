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
    description: 'Progress and arriving pay, and running a red light or leaving the road costs. It trains the small Driving Starter brain.',
    source: DRIVING_BEGINNER,
  },
  {
    id: 'driving-intermediate',
    name: 'Intermediate',
    tier: 'intermediate',
    env: 'driving',
    description: 'The built-in reward written out, with a cost for every broken rule. It pays for progress and arriving, and runs exactly like a run without a script.',
    source: DRIVING_INTERMEDIATE,
  },
  {
    id: 'driving-advanced',
    name: 'Advanced',
    tier: 'advanced',
    env: 'driving',
    description: 'The built-in reward plus care around people and cars. Once the lights are learned, it trains in new random cities.',
    source: DRIVING_ADVANCED,
  },
];
