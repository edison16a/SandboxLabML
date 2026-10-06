import type { Rng } from '../../../core/rng';
import { entriesFor } from '../../registry';
import { dimOf, formatDim, type UnitName } from '../../units';

/** A unit spelled as the printer writes it. Plain numbers use the empty string. */
export type U = '' | 'm' | 's' | 'rad' | 'm/s' | '1/m';
export const UNITS: readonly U[] = ['', 'm', 's', 'rad', 'm/s', '1/m'];

export interface Local {
  name: string;
  kind: 'num' | 'bool';
  unit: U;
}

/** What expressions may refer to at the current point of the program. */
export interface Env {
  rng: Rng;
  scope: 'tick' | 'generation';
  locals: Local[];
  /** Script sensors run before the brain, so they may not read brain outputs. */
  sensor?: boolean;
}

const NUMBERS = ['0.5', '1', '2', '3', '10', '0.01', '0.002', '25', '0.25', '7'];

function sensorsBy(scope: 'tick' | 'generation'): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of entriesFor('racing', scope)) {
    if (e.kind !== 'sensor' || e.type !== 'number') continue;
    const key = formatDim(dimOf(e.unit as UnitName));
    map.set(key, [...(map.get(key) ?? []), e.name]);
  }
  return map;
}

const TICK_SENSORS = sensorsBy('tick');
const GEN_SENSORS = sensorsBy('generation');
const BOOL_SENSORS = entriesFor('racing', 'tick')
  .filter((e) => e.kind === 'sensor' && e.type === 'bool')
  .map((e) => e.name);

export function literal(env: Env, unit: U): string {
  const n = env.rng.pick(NUMBERS);
  if (unit === 'rad' && env.rng.chance(0.4)) return `${n} deg`;
  if (unit === '' && env.rng.chance(0.2)) return `${n}%`;
  return unit === '' ? n : `${n} ${unit}`;
}

/** A random number expression with the given unit. Depth limits the size. */
export function numExpr(env: Env, unit: U, depth: number): string {
  const { rng } = env;
  const leaf = depth <= 0 || rng.chance(0.35);
  if (leaf) {
    const all = (env.scope === 'tick' ? TICK_SENSORS : GEN_SENSORS).get(unit) ?? [];
    const sensors = env.sensor ? all.filter((n) => !n.startsWith('brain.')) : all;
    const locals = env.locals.filter((l) => l.kind === 'num' && l.unit === unit).map((l) => l.name);
    const options = [...sensors, ...locals];
    if (unit === 'm' && env.scope === 'tick' && rng.chance(0.2)) return `car.ray(${rng.int(3)})`;
    if (unit === '1/m' && env.scope === 'tick') return `track.curvatureAhead(distance: ${literal(env, 'm')})`;
    if (unit === '' && rng.chance(0.15)) return 'rand()';
    if (options.length > 0 && rng.chance(0.7)) return rng.pick(options);
    return literal(env, unit);
  }
  const d = depth - 1;
  switch (rng.int(7)) {
    case 0:
      return `${numExpr(env, unit, d)} + ${numExpr(env, unit, d)}`;
    case 1:
      return `${numExpr(env, unit, d)} - (${numExpr(env, unit, d)})`;
    case 2:
      return `${literal(env, '')} * ${numExpr(env, unit, d)}`;
    case 3:
      return `(${numExpr(env, unit, d)}) / ${rng.pick(['2', '4', '10'])}`;
    case 4:
      return `-(${numExpr(env, unit, d)})`;
    case 5:
      return `${rng.pick(['min', 'max'])}(${numExpr(env, unit, d)}, ${numExpr(env, unit, d)})`;
    default:
      return rng.chance(0.5) ? `abs(${numExpr(env, unit, d)})` : `clamp(${numExpr(env, unit, d)}, ${literal(env, unit)}, ${literal(env, unit)})`;
  }
}

/** A random condition. */
export function boolExpr(env: Env, depth: number): string {
  const { rng } = env;
  const locals = env.locals.filter((l) => l.kind === 'bool').map((l) => l.name);
  if (depth <= 0 || rng.chance(0.3)) {
    if (env.scope === 'tick' && rng.chance(0.5)) return rng.pick(BOOL_SENSORS);
    if (locals.length > 0 && rng.chance(0.5)) return rng.pick(locals);
    return compare(env, 0);
  }
  const d = depth - 1;
  switch (rng.int(4)) {
    case 0:
      return `${boolExpr(env, d)} and ${boolExpr(env, d)}`;
    case 1:
      return `(${boolExpr(env, d)}) or ${boolExpr(env, d)}`;
    case 2:
      return `not (${boolExpr(env, d)})`;
    default:
      return compare(env, d);
  }
}

function compare(env: Env, depth: number): string {
  const unit = env.scope === 'tick' ? env.rng.pick(UNITS) : '';
  const op = env.rng.pick(['<', '>', '<=', '>=', '==', '!=']);
  return `${numExpr(env, unit, depth)} ${op} ${numExpr(env, unit, depth)}`;
}
