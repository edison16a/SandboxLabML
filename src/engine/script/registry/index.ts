import type { EnvId } from '../../env/types';
import { CORE_SLICE } from './core';
import { GENERATION_SLICE } from './generation';
import { HIDESEEK_SLICE } from './hideseek';
import { RACING_SLICE } from './racing';
import type { RegistryEntry, RegistrySlice, Scope } from './types';

export * from './types';

/**
 * Every registry slice. The registry is the single source of truth for what
 * scripts can use: the checker, compiler, docs, block palette and
 * autocomplete all read it. A new environment is one slice file plus one
 * line here.
 */
export const SLICES: readonly RegistrySlice[] = [CORE_SLICE, GENERATION_SLICE, RACING_SLICE, HIDESEEK_SLICE];

export const REGISTRY: readonly RegistryEntry[] = SLICES.flatMap((s) => s.entries);

/** Environments a script header may name, even before their slice exists. */
export const SCRIPT_ENVS: readonly EnvId[] = ['racing', 'hideseek'];

export type BlockScope = 'tick' | 'generation';

const byEnv = new Map<EnvId | null, ReadonlyMap<string, RegistryEntry>>();
const renamesByEnv = new Map<EnvId | null, ReadonlyMap<string, RegistryEntry>>();

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

/** Finds an entry by name in any environment, used to explain "this belongs to racing". */
export function findAnywhere(name: string): RegistryEntry | undefined {
  return REGISTRY.find((e) => e.name === name);
}

export function sliceFor(env: EnvId | null): RegistrySlice | undefined {
  return SLICES.find((s) => s.env === env);
}

/** First parts of every registry name, such as "car". A let may not reuse one, or `car.speed` would become ambiguous. */
export const RESERVED_ROOTS: ReadonlySet<string> = new Set(REGISTRY.map((e) => e.name.split('.')[0]));

export function scopeLabel(scope: Scope): string {
  return scope === 'tick' ? 'each tick' : scope === 'generation' ? 'each generation' : 'any block';
}
