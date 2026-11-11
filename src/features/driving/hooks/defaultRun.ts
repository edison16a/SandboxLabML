import { DEFAULT_DRIVING_BLUEPRINT } from '@/engine/driving/blueprints';
import { DEFAULT_DRIVING_SETTINGS } from '@/engine/driving/run/settings';
import { createEpisodeRunConfig } from '@/engine/training/newRun';

/** The setting that remembers the Driving run opened last. */
export const LAST_RUN_KEY = 'driving.lastRun';

/** The run a first time visitor gets: the Standard brain in Midtown, starting on empty streets with the curriculum on. */
export function defaultDrivingRun() {
  return createEpisodeRunConfig({
    env: 'driving',
    name: 'First drives',
    seed: Math.floor(Math.random() * 1e9),
    blueprint: DEFAULT_DRIVING_BLUEPRINT,
    populationSize: 100,
    settings: { ...DEFAULT_DRIVING_SETTINGS },
  });
}
