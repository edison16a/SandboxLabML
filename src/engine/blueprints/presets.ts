import { episodeEnvIds, requireEpisodeInfo } from '../env/registry';
import { STANDARD_HIDESEEK_INPUTS } from '../hideseek/inputConfig';
import { BLUEPRINT_SCHEMA_VERSION, type Blueprint, type HideSeekBlueprint } from './types';

export { RACING_BLUEPRINTS } from './racingPresets';

const base = { schemaVersion: BLUEPRINT_SCHEMA_VERSION, readonly: true, activation: 'tanh', wiring: 'direct' } as const;

export const HIDESEEK_BLUEPRINTS: HideSeekBlueprint[] = [
  {
    ...base,
    id: 'hideseek-starter',
    name: 'Hide and Seek Starter',
    env: 'hideseek',
    tier: 'starter',
    description: 'Eight distance rays, speed, opponent visible, phase and the nearest ramp. 17 inputs.',
    teaches: 'Hiding and seeking without boxes.',
    inputs: {
      ...STANDARD_HIDESEEK_INPUTS,
      rays: { count: 8, range: 12, hitTypes: false },
      speed: true,
      velocity: false,
      holding: false,
      time: false,
      opponentLastSeen: false,
    },
  },
  {
    ...base,
    id: 'hideseek-standard',
    name: 'Hide and Seek Standard',
    env: 'hideseek',
    tier: 'standard',
    description: 'Sixteen rays with hit types, velocity, holding, phase, time, opponent and the nearest ramp. 61 inputs.',
    teaches: 'Box building, shelters and ramps.',
    inputs: STANDARD_HIDESEEK_INPUTS,
  },
  {
    ...base,
    id: 'hideseek-advanced',
    name: 'Hide and Seek Advanced',
    env: 'hideseek',
    tier: 'advanced',
    description: 'Standard plus position and lock state of the two nearest crates. 69 inputs.',
    teaches: 'Faster shelter discovery.',
    inputs: { ...STANDARD_HIDESEEK_INPUTS, nearestBoxes: 2 },
  },
];

/**
 * Every preset brain: each episode env's own, in registry order, then Hide
 * and Seek's. Read from the registry on each call, so an env a test
 * registers has its brains too.
 */
export function presetBlueprints(): Blueprint[] {
  return [...episodeEnvIds().flatMap((env) => requireEpisodeInfo(env).blueprints), ...HIDESEEK_BLUEPRINTS];
}

export function findPresetBlueprint(id: string): Blueprint | undefined {
  return presetBlueprints().find((b) => b.id === id);
}
