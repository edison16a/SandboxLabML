import type { EnvId } from '../env/types';
import type { HideSeekInputConfig } from '../hideseek/inputConfig';
import type { NeatConfig } from '../neat/config';
import type { Activation, GenomeShape } from '../neat/types';
import type { RacingInputConfig } from '../racing/sensors/inputConfig';

export const BLUEPRINT_SCHEMA_VERSION = 1;

/** Limits that keep the network graph under its 300-neuron budget. */
export const MAX_INPUTS = 128;
export const MAX_OUTPUTS = 8;

export type BlueprintTier = 'tiny' | 'starter' | 'standard' | 'advanced' | 'custom';

interface BlueprintBase {
  id: string;
  name: string;
  tier: BlueprintTier;
  description: string;
  /** One line on what training this brain teaches, shown in the picker. */
  teaches: string;
  schemaVersion: number;
  /** Presets are read-only; editing one makes a copy. */
  readonly: boolean;
  activation: Activation;
  wiring: GenomeShape['wiring'];
  hiddenCount?: number;
  /** Optional NEAT overrides, such as population size or mutation rates. */
  neat?: Partial<Pick<NeatConfig, 'populationSize' | 'targetSpecies' | 'crossoverRate'>> & {
    mutation?: Partial<NeatConfig['mutation']>;
  };
}

export interface RacingBlueprint extends BlueprintBase {
  env: 'racing';
  inputs: RacingInputConfig;
}

export interface HideSeekBlueprint extends BlueprintBase {
  env: 'hideseek';
  inputs: HideSeekInputConfig;
}

/**
 * What a brain senses and how it starts out. Stored as JSON in the
 * blueprints table and frozen into a run's config when the run is created.
 */
export type Blueprint = RacingBlueprint | HideSeekBlueprint;

export function isEnv<E extends EnvId>(b: Blueprint, env: E): b is Extract<Blueprint, { env: E }> {
  return b.env === env;
}
