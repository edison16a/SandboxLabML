import type { EnvId } from '@/engine/env/types';
import { entriesByName, renamesFor, scopeLabel, type ParamDef, type RegistryEntry } from '@/engine/script';

const KIND_LABELS: Record<RegistryEntry['kind'], string> = {
  sensor: 'Sensor',
  function: 'Function',
  action: 'Action',
  operator: 'Operator',
  collection: 'List',
  constant: 'Constant',
};

export function kindLabel(e: RegistryEntry): string {
  return KIND_LABELS[e.kind];
}

function unitWords(unit: string): string {
  if (unit === '') return 'no unit';
  if (unit === '*') return 'any unit';
  if (unit === 'sqrt') return 'half the unit of its input';
  return unit;
}

function paramText(p: ParamDef): string {
  const unit = p.type === 'number' && p.unit !== '' ? ` ${p.unit === '*' ? 'any unit' : p.unit}` : '';
  const def = p.required ? '' : ` = ${typeof p.default === 'string' ? `"${p.default}"` : String(p.default ?? '')}`;
  return `${p.name}: ${p.type}${unit}${def}`;
}

/**
 * How an entry is written, such as `drive(steer: number, pedal: number)` or
 * `car.speed: number in m/s`. Hover cards and the Reference tab share it so
 * the two never disagree.
 */
export function signatureOf(e: RegistryEntry): string {
  if (e.kind === 'sensor' || e.kind === 'constant') {
    return e.type === 'bool' ? `${e.name}: true or false` : `${e.name}: number${e.unit === '' ? '' : ` in ${unitWords(e.unit)}`}`;
  }
  if (e.kind === 'collection') return `for each item in ${e.name}`;
  return `${e.name}(${e.params.map(paramText).join(', ')})`;
}

/** One line about units: what the entry returns and what its parameters take. */
export function unitsOf(e: RegistryEntry): string {
  if (e.type === 'bool') return 'Gives true or false.';
  const takes = e.params.filter((p) => p.type === 'number').map((p) => `${p.name} in ${unitWords(p.unit)}`);
  const gives = e.type === 'void' ? '' : `Gives ${unitWords(e.unit)}.`;
  return [gives, takes.length > 0 ? `Takes ${takes.join(', ')}.` : ''].filter(Boolean).join(' ') || 'No units.';
}

export function whereUsable(e: RegistryEntry): string {
  return `Use in ${scopeLabel(e.scope)}.`;
}

export function tiersOf(e: RegistryEntry): string {
  if (e.presets.length === 0) return 'Not used by the presets yet.';
  return `Used by the ${e.presets.map((t) => t[0].toUpperCase() + t.slice(1)).join(', ')} preset${e.presets.length > 1 ? 's' : ''}.`;
}

/** Finds an entry by its current name or an old one that still works. */
export function lookupEntry(env: EnvId | null, name: string): RegistryEntry | undefined {
  return entriesByName(env).get(name) ?? renamesFor(env).get(name);
}
