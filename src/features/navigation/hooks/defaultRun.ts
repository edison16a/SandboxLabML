import { NAVIGATION_BLUEPRINTS } from '@/engine/navigation/pipeline/blueprints';
import { navigationSettings } from '@/engine/navigation/pipeline/settings';
import { createEpisodeRunConfig } from '@/engine/training/newRun';

/** The setting that remembers the Navigation run opened last. */
export const LAST_RUN_KEY = 'navigation.lastRun';

/** The brain a new run starts on: Standard, which learns every level. */
export const DEFAULT_NAVIGATION_BLUEPRINT = NAVIGATION_BLUEPRINTS[1];

/** The run a first time visitor gets: the built in reward from the straight run up, so the lab is alive the moment it opens. */
export function defaultNavigationRun() {
  return createEpisodeRunConfig({
    env: 'navigation',
    name: 'First steps',
    seed: Math.floor(Math.random() * 1e9),
    blueprint: DEFAULT_NAVIGATION_BLUEPRINT,
    populationSize: 100,
    settings: { ...navigationSettings() },
  });
}
