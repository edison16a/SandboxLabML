import { NAVIGATION_ADVANCED } from './navigationAdvanced';
import { NAVIGATION_BEGINNER } from './navigationBeginner';
import { NAVIGATION_INTERMEDIATE } from './navigationIntermediate';
import type { ScriptPreset } from './types';

export const NAVIGATION_PRESETS: readonly ScriptPreset[] = [
  {
    id: 'navigation-beginner',
    name: 'Beginner',
    tier: 'beginner',
    env: 'navigation',
    description: 'Points for new ground and a finish bonus, nothing else. The quickest way to see runners learn.',
    source: NAVIGATION_BEGINNER,
  },
  {
    id: 'navigation-intermediate',
    name: 'Intermediate',
    tier: 'intermediate',
    env: 'navigation',
    description: 'The built-in reward written out, with costs for dying and idling. It pays for new ground and the finish, and trains exactly like a run without a script on the same brain.',
    source: NAVIGATION_INTERMEDIATE,
  },
  {
    id: 'navigation-advanced',
    name: 'Advanced',
    tier: 'advanced',
    env: 'navigation',
    description: 'Dying costs more and brushing spikes costs a little. Harder levels run three courses per brain, so it learns to stay safe in any room.',
    source: NAVIGATION_ADVANCED,
  },
];
