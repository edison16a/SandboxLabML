import type { HideSeekAgent } from '../../../hideseek/agents/agent';
import { entry } from '../define';
import type { BlockCategory, PresetTier, Reader, RegistryEntry, Test } from '../types';

/** Every Hide and Seek tick binding receives the agent's HideSeekAgent view. */
export const agent = (v: unknown) => v as HideSeekAgent;

export const ALL_TIERS: readonly PresetTier[] = ['beginner', 'intermediate', 'advanced'];

/** The documentation every Hide and Seek sensor carries. */
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
  cost?: number;
}

function base(d: SensorDocs) {
  const { label, category, ...rest } = d;
  return { ...rest, kind: 'sensor' as const, scope: 'tick' as const, env: 'hideseek' as const, block: { category: category ?? 'sensors', label } };
}

/** A number sensor. `read` is the closure for one call site, usually a direct field read. */
export function numSensor(d: SensorDocs, read: Reader): RegistryEntry {
  return entry({ ...base(d), type: 'number', binding: { kind: 'num', read: () => read } });
}

/** A true or false sensor, read straight from a field. */
export function boolSensor(d: SensorDocs, read: Test): RegistryEntry {
  return entry({ ...base(d), type: 'bool', unit: '', binding: { kind: 'bool', read: () => read } });
}
