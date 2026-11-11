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
    description: 'The built-in reward written out: new ground, the finish, a cost for dying and for standing still. Trains exactly like a run without a script on the same brain.',
    source: NAVIGATION_INTERMEDIATE,
  },
  {
    id: 'navigation-advanced',
    name: 'Advanced',
    tier: 'advanced',
    env: 'navigation',
    description: 'Dying costs more, brushing spikes costs a little, and harder levels run three courses per brain, so it learns to stay safe in any room.',
    source: NAVIGATION_ADVANCED,
  },
];
