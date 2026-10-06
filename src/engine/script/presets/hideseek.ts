import { HIDESEEK_ADVANCED } from './hideseekAdvanced';
import { HIDESEEK_BEGINNER } from './hideseekBeginner';
import { HIDESEEK_INTERMEDIATE } from './hideseekIntermediate';
import type { ScriptPreset } from './types';

/** The Hide and Seek scripts in the picker, one per tier. Like the racing ones they are read only. */
export const HIDESEEK_PRESETS: readonly ScriptPreset[] = [
  {
    id: 'hideseek-beginner',
    name: 'Beginner',
    tier: 'beginner',
    env: 'hideseek',
    description: 'Hiders score while hidden and seekers while they see the hider. A small brain in the open room.',
    source: HIDESEEK_BEGINNER,
  },
  {
    id: 'hideseek-intermediate',
    name: 'Intermediate',
    tier: 'intermediate',
    env: 'hideseek',
    description: 'The built-in v1 rewards written out, with hall of fame opponents in two rooms. Scores exactly like a run without a script.',
    source: HIDESEEK_INTERMEDIATE,
  },
  {
    id: 'hideseek-advanced',
    name: 'Advanced',
    tier: 'advanced',
    env: 'hideseek',
    description: 'Cover rewards for hiders, a shelter bonus, seeker approach shaping, a scripted sparring partner and a shrinking prep phase.',
    source: HIDESEEK_ADVANCED,
  },
];
