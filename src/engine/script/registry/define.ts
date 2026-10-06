import type { ParamDef, ParamType, RegistryEntry, UnitSpec } from './types';

type EntryInit = Omit<RegistryEntry, 'params' | 'presets' | 'cost'> & Partial<Pick<RegistryEntry, 'params' | 'presets' | 'cost'>>;

/** Fills the fields most entries leave at their defaults, so slice files stay readable. */
export function entry(init: EntryInit): RegistryEntry {
  return { params: [], presets: [], cost: 1, ...init };
}

/** A required parameter. Pass `extra` for defaults, ranges, choices or record fields. */
export function param(name: string, type: ParamType, unit: UnitSpec, summary: string, extra: Partial<ParamDef> = {}): ParamDef {
  return { name, type, unit, required: true, summary, ...extra };
}

/** An optional parameter with a default the operator falls back to. */
export function optional(name: string, type: ParamType, unit: UnitSpec, summary: string, def: number | boolean | string, extra: Partial<ParamDef> = {}): ParamDef {
  return { name, type, unit, required: false, default: def, summary, ...extra };
}

/** Reads a number argument that the checker guaranteed is present. */
export function req<T>(map: ReadonlyMap<string, T>, name: string): T {
  const v = map.get(name);
  if (v === undefined) throw new Error(`Missing argument ${name}. The checker should have caught this.`);
  return v;
}

export function clampTo(x: number, lo: number, hi: number): number {
  if (!(x === x)) return lo;
  return x < lo ? lo : x > hi ? hi : x;
}
