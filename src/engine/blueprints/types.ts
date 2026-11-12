import type { EnvId } from '../env/types';
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
  /** Neurons per hidden layer, and how many layers (1 to 3), when wiring is hidden. */
  hiddenCount?: number;
  hiddenLayers?: number;
  /** Optional NEAT overrides, such as population size or mutation rates. */
  neat?: Partial<Pick<NeatConfig, 'populationSize' | 'targetSpecies' | 'crossoverRate'>> & {
    mutation?: Partial<NeatConfig['mutation']>;
  };
}

export interface RacingBlueprint extends BlueprintBase {
  env: 'racing';
  inputs: RacingInputConfig;
}

/** Ids of the envs that plug in through the env registry after Racing. */
export type EpisodeEnvId = Exclude<EnvId, 'racing'>;

/**
 * The sensor config of an env added through the registry. Only its module
 * reads the groups; every env shares the noise level, which the blueprint
 * form edits for all of them.
 */
export type EpisodeInputs = { noise: number } & Readonly<Record<string, unknown>>;

/**
 * A blueprint of an env added through the env registry. Its inputs are the
 * env's own sensor config, read only by its module (inputCount,
 * inputSchema, validateInputs), so this layer never needs to know them.
 */
export interface EpisodeBlueprint<E extends EpisodeEnvId = EpisodeEnvId, I extends EpisodeInputs = EpisodeInputs> extends BlueprintBase {
  env: E;
  inputs: I;
}

/**
 * What a brain senses and how it starts out. Stored as JSON in the
 * blueprints table and frozen into a run's config when the run is created.
 */
export type Blueprint = RacingBlueprint | EpisodeBlueprint;

export interface BlueprintIssue {
  field: string;
  message: string;
}

export function isEnv<E extends EnvId>(b: Blueprint, env: E): b is Extract<Blueprint, { env: E }> {
  return b.env === env;
}
