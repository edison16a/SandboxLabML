import type { EnvId } from '../../env/types';
import type { PresetTier } from '../registry/types';
import { RACING_ADVANCED } from './racingAdvanced';
import { RACING_BEGINNER } from './racingBeginner';
import { RACING_INTERMEDIATE } from './racingIntermediate';

/** A ready-made script shown in the script picker. Presets are read only, and editing one makes a copy. */
export interface ScriptPreset {
  id: string;
  name: string;
  tier: PresetTier;
  env: EnvId;
  description: string;
  source: string;
}

export const RACING_PRESETS: readonly ScriptPreset[] = [
  {
    id: 'racing-beginner',
    name: 'Beginner',
    tier: 'beginner',
    env: 'racing',
    description: 'Points for checkpoints only, a small brain and the Oval. The fastest way to see cars learn.',
    source: RACING_BEGINNER,
  },
  {
    id: 'racing-intermediate',
    name: 'Intermediate',
    tier: 'intermediate',
    env: 'racing',
    description: 'The built-in reward written out: checkpoints, laps and a little for speed. Runs exactly like a run without a script.',
    source: RACING_INTERMEDIATE,
  },
  {
    id: 'racing-advanced',
    name: 'Advanced',
    tier: 'advanced',
    env: 'racing',
    description: 'Adds a tire slip penalty, a far curvature sensor, adaptive mutation and a random track every 10 generations.',
    source: RACING_ADVANCED,
  },
];

export function findScriptPreset(id: string): ScriptPreset | undefined {
  return RACING_PRESETS.find((p) => p.id === id);
}
