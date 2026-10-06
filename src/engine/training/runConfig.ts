import type { Blueprint, RacingBlueprint } from '../blueprints/types';
import { blueprintShape } from '../blueprints/shape';
import { ENGINE_VERSION } from '../core/version';
import type { EnvId } from '../env/types';
import { neatConfig, type NeatConfig } from '../neat/config';
import type { GenomeShape } from '../neat/types';
import { CAR_PRESETS, physicsHash, type CarParams, type CarPresetId } from '../racing/car/params';
import type { TrackSpec } from '../racing/track/types';

/** A script version and the generation it took effect, so replays use the rules each ghost lived under. */
export interface ScriptVersion {
  fromGeneration: number;
  source: string;
  hash: string;
}

export interface RacingSettings {
  track: TrackSpec;
  carPreset: CarPresetId;
  car: CarParams;
  /** Episode length, s. */
  maxTime: number;
}

/**
 * Everything that defines a run. It is frozen when the run is created: the
 * genome shape, physics and seed never change afterwards, which is what keeps
 * replays exact. Only the script's live-editable parts can change, and each
 * change is recorded as a new ScriptVersion.
 */
export interface RunConfig {
  id: string;
  name: string;
  env: EnvId;
  seed: number;
  createdAt: number;
  engineVersion: number;
  physicsHash: string;
  blueprint: Blueprint;
  /** Empty means the built-in reward. */
  scripts: ScriptVersion[];
  /** Number of extra inputs the script's sensors add. */
  customSensors: number;
  neat: NeatConfig;
  racing?: RacingSettings;
  /** Hide and Seek settings are opaque here so this file does not depend on that engine. */
  hideseek?: Record<string, unknown>;
  /** Set when the run was forked from another run. */
  parent?: { runId: string; generation: number };
}

export function newRunId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface NewRacingRun {
  name: string;
  seed: number;
  blueprint: RacingBlueprint;
  track: TrackSpec;
  carPreset: CarPresetId;
  populationSize: number;
  maxTime?: number;
  script?: { source: string; hash: string; customSensors: number };
}

export function createRacingRunConfig(input: NewRacingRun): RunConfig {
  const car = CAR_PRESETS[input.carPreset];
  const bp = input.blueprint;
  return {
    id: newRunId(),
    name: input.name,
    env: 'racing',
    seed: input.seed >>> 0,
    createdAt: Date.now(),
    engineVersion: ENGINE_VERSION,
    physicsHash: physicsHash(car, { inputs: bp.inputs }),
    blueprint: bp,
    scripts: input.script ? [{ fromGeneration: 0, source: input.script.source, hash: input.script.hash }] : [],
    customSensors: input.script?.customSensors ?? 0,
    neat: neatConfig({
      populationSize: input.populationSize,
      ...(bp.neat ?? {}),
      mutation: { ...neatConfig().mutation, ...(bp.neat?.mutation ?? {}) },
    }),
    racing: { track: input.track, carPreset: input.carPreset, car, maxTime: input.maxTime ?? 60 },
  };
}

export function runShape(config: RunConfig): GenomeShape {
  return blueprintShape(config.blueprint, config.customSensors);
}

/** The script in force at a generation, or null for the built-in reward. */
export function scriptAt(config: RunConfig, generation: number): ScriptVersion | null {
  let found: ScriptVersion | null = null;
  for (const v of config.scripts) if (v.fromGeneration <= generation) found = v;
  return found;
}
