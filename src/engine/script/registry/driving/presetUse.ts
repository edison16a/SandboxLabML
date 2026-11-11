import type { PresetTier, RegistryEntry } from '../types';

const ALL: readonly PresetTier[] = ['beginner', 'intermediate', 'advanced'];
const UPPER: readonly PresetTier[] = ['intermediate', 'advanced'];
const ADVANCED: readonly PresetTier[] = ['advanced'];

/**
 * Which Driving presets use each entry, so the reference and autocomplete
 * can point at a preset that shows it in use. A test checks this table
 * against what the preset scripts really read.
 */
const USED_BY: Readonly<Record<string, readonly PresetTier[]>> = {
  drive: ALL,
  'brain.steer': ALL,
  'brain.pedal': ALL,
  'route.gain': ALL,
  'car.arrived': ALL,
  'car.noProgress': ALL,
  'car.offRoad': ['beginner'],
  autoLevel: ['beginner'],
  'car.speed': UPPER,
  'route.remaining': UPPER,
  'rules.ranRedLight': UPPER,
  'rules.overranStopLine': UPPER,
  'rules.speeding': UPPER,
  'rules.wrongWay': UPPER,
  'rules.laneDeparture': UPPER,
  'car.overCurb': UPPER,
  'car.crashed': UPPER,
  'car.hitPedestrian': UPPER,
  'person.ahead': ADVANCED,
  'person.distance': ADVANCED,
  'carAhead.seen': ADVANCED,
  'carAhead.gap': ADVANCED,
  'curriculum.level': ADVANCED,
  randomCity: ADVANCED,
  useCity: ADVANCED,
};

/** The entries with their preset tags filled in from the table above. */
export function withPresetUse(entries: readonly RegistryEntry[]): RegistryEntry[] {
  return entries.map((e) => (USED_BY[e.name] ? { ...e, presets: USED_BY[e.name] } : e));
}
