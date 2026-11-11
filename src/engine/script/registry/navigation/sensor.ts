import type { NavAgent } from '../../../navigation/agent';
import { entry } from '../define';
import type { BlockCategory, PresetTier, Reader, RegistryEntry, Test } from '../types';

/** Every Navigation tick binding receives the runner's NavAgent view. */
export const runner = (v: unknown) => v as NavAgent;

export const ALL_TIERS: readonly PresetTier[] = ['beginner', 'intermediate', 'advanced'];
/** Entries the Intermediate and Advanced presets use and Beginner leaves out. */
export const LATER: readonly PresetTier[] = ['intermediate', 'advanced'];
export const ADVANCED: readonly PresetTier[] = ['advanced'];

/** The documentation every Navigation sensor carries. */
export interface SensorDocs {
  name: string;
  unit: RegistryEntry['unit'];
  summary: string;
  description: string;
  example: string;
  explain: string;
  label: string;
  presets?: readonly PresetTier[];
  range?: readonly [number, number];
  category?: BlockCategory;
  progress?: boolean;
  notInSensor?: boolean;
}

function base(d: SensorDocs) {
  const { label, category, ...rest } = d;
  return { ...rest, kind: 'sensor' as const, scope: 'tick' as const, env: 'navigation' as const, block: { category: category ?? 'sensors', label } };
}

/** A number sensor. `read` is the closure for one call site, usually a direct field read. */
export function numSensor(d: SensorDocs, read: Reader): RegistryEntry {
  return entry({ ...base(d), type: 'number', binding: { kind: 'num', read: () => read } });
}

/** A true or false sensor, read straight from a field. */
export function boolSensor(d: SensorDocs, read: Test): RegistryEntry {
  return entry({ ...base(d), type: 'bool', unit: '', binding: { kind: 'bool', read: () => read } });
}
