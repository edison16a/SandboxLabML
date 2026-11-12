import type { EnvId } from '../../env/types';
import { onScriptEnvsChanged, SCRIPT_ENV_TABLE } from '../envs';
import { CORE_SLICE } from './core';
import { GENERATION_SLICE } from './generation';
import type { RegistryEntry, RegistrySlice, Scope } from './types';

export * from './types';
export { metricSensor, setEnvDirective, type MetricSensorDocs } from './envHelpers';

/**
 * Every registry slice. The registry is the single source of truth for what
 * scripts can use: the checker, compiler, docs, block palette and
 * autocomplete all read it. A new environment is a slice folder plus one
 * line in the script env table (../envs.ts). The lists below follow that
 * table, so a row a test registers shows up in them too.
 */
const slices: RegistrySlice[] = [];
const registry: RegistryEntry[] = [];
const envs: EnvId[] = [];
const roots = new Set<string>();

export const SLICES: readonly RegistrySlice[] = slices;

export const REGISTRY: readonly RegistryEntry[] = registry;

/** Environments a script header may name: every env in the script env table. */
export const SCRIPT_ENVS: readonly EnvId[] = envs;

/** First parts of every registry name, such as "car". A let may not reuse one, or `car.speed` would become ambiguous. */
export const RESERVED_ROOTS: ReadonlySet<string> = roots;

export type BlockScope = 'tick' | 'generation';

const byEnv = new Map<EnvId | null, ReadonlyMap<string, RegistryEntry>>();
const renamesByEnv = new Map<EnvId | null, ReadonlyMap<string, RegistryEntry>>();

/** Refills the lists from the script env table, in place, and drops the lookups built from the old ones. */
function rebuild(): void {
  slices.splice(0, slices.length, CORE_SLICE, GENERATION_SLICE, ...SCRIPT_ENV_TABLE.map((e) => e.slice));
  registry.splice(0, registry.length, ...slices.flatMap((sl) => sl.entries));
  envs.splice(0, envs.length, ...SCRIPT_ENV_TABLE.map((e) => e.env));
  roots.clear();
  for (const e of registry) roots.add(e.name.split('.')[0]);
  byEnv.clear();
  renamesByEnv.clear();
}
rebuild();
onScriptEnvsChanged(rebuild);

/** Core entries plus the slice for `env`. A null env (an unknown header) sees only core. */
function visible(env: EnvId | null): RegistryEntry[] {
  return SLICES.filter((s) => s.env === 'core' || s.env === env).flatMap((s) => s.entries);
}

/** Entries a script for `env` can see, by name. Maps are used so names like "constructor" never hit Object.prototype. */
export function entriesByName(env: EnvId | null): ReadonlyMap<string, RegistryEntry> {
  let map = byEnv.get(env);
  if (!map) {
    map = new Map(visible(env).map((e) => [e.name, e]));
    byEnv.set(env, map);
  }
  return map;
}

/** Old names that still work in scripts for `env`, mapped to their current entry. */
export function renamesFor(env: EnvId | null): ReadonlyMap<string, RegistryEntry> {
  let map = renamesByEnv.get(env);
  if (!map) {
    map = new Map(visible(env).flatMap((e) => (e.renamedFrom ?? []).map((old) => [old, e] as const)));
    renamesByEnv.set(env, map);
  }
  return map;
}

export function inScope(e: RegistryEntry, scope: BlockScope): boolean {
  return e.scope === 'both' || e.scope === scope;
}

/** Entries usable inside one kind of block, in registry order. */
export function entriesFor(env: EnvId | null, scope: BlockScope): RegistryEntry[] {
  return [...entriesByName(env).values()].filter((e) => inScope(e, scope));
}

/** Finds an entry by name in any environment, used to explain "this belongs to driving". */
export function findAnywhere(name: string): RegistryEntry | undefined {
  return REGISTRY.find((e) => e.name === name);
}

export function sliceFor(env: EnvId | null): RegistrySlice | undefined {
  return SLICES.find((s) => s.env === env);
}

export function scopeLabel(scope: Scope): string {
  return scope === 'tick' ? 'each tick' : scope === 'generation' ? 'each generation' : 'any block';
}
