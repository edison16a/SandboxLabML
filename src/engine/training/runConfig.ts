import type { Blueprint } from '../blueprints/types';
import { blueprintShape } from '../blueprints/shape';
import type { EnvId } from '../env/types';
import type { NeatConfig } from '../neat/config';
import type { GenomeShape } from '../neat/types';

/** A script version and the generation it took effect, so replays use the rules each ghost lived under. */
export interface ScriptVersion {
  fromGeneration: number;
  source: string;
  hash: string;
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
  /**
   * The env's own options (a city, a level, an episode length), opaque
   * here and read only by the env's module through envSettings.
   */
  settings?: Readonly<Record<string, unknown>>;
  /** Set when the run was forked from another run. */
  parent?: { runId: string; generation: number };
}

export function newRunId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A registry env's options, typed by the module that reads them. Throws when the run has none. */
export function envSettings<T>(config: RunConfig): T {
  if (!config.settings) throw new Error(`This ${config.env} run has no settings.`);
  return config.settings as T;
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
