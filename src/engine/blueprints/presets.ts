import { episodeEnvIds, requireEpisodeInfo } from '../env/registry';
import type { Blueprint } from './types';

export { RACING_BLUEPRINTS } from './racingPresets';

/**
 * Every preset brain: each env's own, in registry order. Read from the
 * registry on each call, so an env a test registers has its brains too.
 */
export function presetBlueprints(): Blueprint[] {
  return episodeEnvIds().flatMap((env) => requireEpisodeInfo(env).blueprints);
}

export function findPresetBlueprint(id: string): Blueprint | undefined {
  return presetBlueprints().find((b) => b.id === id);
}
