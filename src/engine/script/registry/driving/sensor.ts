import type { DrivingLearner } from '../../../driving/agent/learner';
import { entry } from '../define';
import type { BindContext, BlockCategory, PresetTier, Reader, RegistryEntry, Scope, Test } from '../types';

/** Every driving tick binding receives a DrivingLearner view. */
export const learner = (v: unknown) => v as DrivingLearner;

/** What a driving sensor says about itself, in the registry's words. */
export interface DrivingSensorDocs {
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
  scope?: Scope;
  progress?: boolean;
  notInSensor?: boolean;
}

function base(d: DrivingSensorDocs) {
  const { label, category, scope, ...rest } = d;
  return { ...rest, kind: 'sensor' as const, scope: scope ?? ('tick' as const), env: 'driving' as const, block: { category: category ?? 'sensors', label } };
}

/** A driving number sensor. `read` returns the closure for one call site. */
export function numSensor(d: DrivingSensorDocs, read: (ctx: BindContext) => Reader): RegistryEntry {
  return entry({ ...base(d), type: 'number', binding: { kind: 'num', read } });
}

export function boolSensor(d: DrivingSensorDocs, read: (ctx: BindContext) => Test): RegistryEntry {
  return entry({ ...base(d), type: 'bool', unit: '', binding: { kind: 'bool', read } });
}
