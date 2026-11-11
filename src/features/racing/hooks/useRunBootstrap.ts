'use client';

import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { createRacingRunConfig } from '@/engine/training/runConfig';

/** The setting that remembers the Racing run opened last. */
export const LAST_RUN_KEY = 'racing.lastRun';

/** The run a first time visitor gets, so the lab is alive the moment it opens. */
export function defaultRacingRun() {
  return createRacingRunConfig({
    name: 'First laps',
    seed: Math.floor(Math.random() * 1e9),
    blueprint: RACING_BLUEPRINTS[2],
    track: BUILT_IN_TRACKS[0],
    carPreset: 'standard',
    populationSize: 100,
  });
}
