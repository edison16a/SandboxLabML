import type { RacingCar } from '../../../racing/car/runtime';
import { entry } from '../define';
import type { BlockCategory, PresetTier, RegistryEntry, Scope, Test, Reader, BindContext } from '../types';

/** Every racing tick binding receives a RacingCar view. */
export const car = (v: unknown) => v as RacingCar;

export const ALL_TIERS: readonly PresetTier[] = ['beginner', 'intermediate', 'advanced'];

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
  scope?: Scope;
  progress?: boolean;
  renamedFrom?: readonly string[];
  notInSensor?: boolean;
  needs?: readonly 'track'[];
  cost?: number;
}

function base(d: SensorDocs) {
  const { label, category, scope, ...rest } = d;
  return { ...rest, kind: 'sensor' as const, scope: scope ?? ('tick' as const), env: 'racing' as const, block: { category: category ?? 'sensors', label } };
}

/** A racing number sensor. `read` returns the closure for one call site. */
export function numSensor(d: SensorDocs, read: (ctx: BindContext) => Reader): RegistryEntry {
  return entry({ ...base(d), type: 'number', binding: { kind: 'num', read } });
}

export function boolSensor(d: SensorDocs, read: (ctx: BindContext) => Test): RegistryEntry {
  return entry({ ...base(d), type: 'bool', unit: '', binding: { kind: 'bool', read } });
}

/** The track from the controller context. Missing it is an integration bug, so it fails loudly at build time. */
export function trackOf(ctx: BindContext) {
  const track = ctx.controller.track;
  if (!track) throw new Error('This script reads the track, so createController needs ctx.track.');
  return track;
}
