import { HIDESEEK_PRESETS } from './hideseek';
import { RACING_ADVANCED } from './racingAdvanced';
import { RACING_BEGINNER } from './racingBeginner';
import { RACING_INTERMEDIATE } from './racingIntermediate';
import type { ScriptPreset } from './types';

export type { ScriptPreset };

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
    description: 'Rotates through every built-in circuit and adds a tire slip penalty, so the brain learns to read any road instead of memorizing one.',
    source: RACING_ADVANCED,
  },
];

/**
 * Every preset of every environment, racing first. It lives in this file
 * so code that already imports findScriptPreset from here keeps working.
 */
export const SCRIPT_PRESETS: readonly ScriptPreset[] = [...RACING_PRESETS, ...HIDESEEK_PRESETS];

/** Finds a preset of any environment by id. */
export function findScriptPreset(id: string): ScriptPreset | undefined {
  return SCRIPT_PRESETS.find((p) => p.id === id);
}
