import { NAVIGATION_BLUEPRINTS } from '@/engine/navigation/pipeline/blueprints';
import { navigationSettings } from '@/engine/navigation/pipeline/settings';
import { createEpisodeRunConfig } from '@/engine/training/newRun';

/** The setting that remembers the Navigation run opened last. */
export const LAST_RUN_KEY = 'navigation.lastRun';

/**
 * The brain a new run starts on: Starter, the one every preset, lesson and
 * reference curve uses. With only 11 inputs it tunes fastest, and the path
 * hint leads it round spikes too, so it scores well above Standard on the
 * benchmark (docs/benchmark.md). A first run then climbs along the
 * reference curves instead of far below them.
 */
export const DEFAULT_NAVIGATION_BLUEPRINT = NAVIGATION_BLUEPRINTS[0];

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
