/**
 * Units as dimension vectors over meters, seconds and radians. The checker
 * multiplies and compares these, so `car.distance + 5 s` is caught before a
 * run starts instead of quietly training on nonsense.
 */

/** Exponents of [m, s, rad]. Meters per second is [1, -1, 0]. */
export type Dim = readonly [number, number, number];

export const UNITLESS: Dim = [0, 0, 0];

/** Units a script can write after a number. The empty string means none. */
export type UnitName = '' | 'm' | 's' | 'rad' | 'deg' | 'm/s' | 'm/s2' | '1/m' | '%';

interface UnitDef {
  dim: Dim;
  /** Multiply the written number by this to get base units (rad, plain fraction). */
  scale: number;
}

const UNIT_DEFS: ReadonlyMap<UnitName, UnitDef> = new Map<UnitName, UnitDef>([
  ['', { dim: UNITLESS, scale: 1 }],
  ['m', { dim: [1, 0, 0], scale: 1 }],
  ['s', { dim: [0, 1, 0], scale: 1 }],
  ['rad', { dim: [0, 0, 1], scale: 1 }],
  ['deg', { dim: [0, 0, 1], scale: Math.PI / 180 }],
  ['m/s', { dim: [1, -1, 0], scale: 1 }],
  ['m/s2', { dim: [1, -2, 0], scale: 1 }],
  ['1/m', { dim: [-1, 0, 0], scale: 1 }],
  ['%', { dim: UNITLESS, scale: 0.01 }],
]);

/** How units may be spelled after a number, longest first so the lexer matches greedily. */
export const UNIT_SPELLINGS: ReadonlyArray<readonly [string, UnitName]> = [
  ['m/s²', 'm/s2'],
  ['m/s2', 'm/s2'],
  ['m/s', 'm/s'],
  ['1/m', '1/m'],
  ['rad', 'rad'],
  ['deg', 'deg'],
  ['m', 'm'],
  ['s', 's'],
];

/** Words people type for units, mapped to the real spelling so autocorrect can offer it. */
export const UNIT_ALIASES: ReadonlyMap<string, UnitName> = new Map<string, UnitName>([
  ['sec', 's'],
  ['secs', 's'],
  ['second', 's'],
  ['seconds', 's'],
  ['meter', 'm'],
  ['meters', 'm'],
  ['metre', 'm'],
  ['metres', 'm'],
  ['mps', 'm/s'],
  ['degree', 'deg'],
  ['degrees', 'deg'],
  ['radian', 'rad'],
  ['radians', 'rad'],
]);

export function isUnitName(text: string): text is UnitName {
  return UNIT_DEFS.has(text as UnitName);
}

export function dimOf(unit: UnitName): Dim {
  return UNIT_DEFS.get(unit)?.dim ?? UNITLESS;
}

/** Converts a written number to base units: degrees become radians and 20% becomes 0.2. */
export function toBase(value: number, unit: UnitName): number {
  return value * (UNIT_DEFS.get(unit)?.scale ?? 1);
}

export function sameDim(a: Dim, b: Dim): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function isUnitless(d: Dim): boolean {
  return d[0] === 0 && d[1] === 0 && d[2] === 0;
}

export function mulDim(a: Dim, b: Dim): Dim {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function divDim(a: Dim, b: Dim): Dim {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Half of every exponent, or null when a square root would leave a fractional unit. */
export function sqrtDim(a: Dim): Dim | null {
  if (a.some((x) => x % 2 !== 0)) return null;
  return [a[0] / 2, a[1] / 2, a[2] / 2];
}

/** The unit to write after a number for this dimension, or null when no short spelling exists. */
export function literalUnitFor(d: Dim): UnitName | null {
  for (const [name, def] of UNIT_DEFS) {
    if (name === 'deg' || name === '%') continue;
    if (sameDim(def.dim, d)) return name;
  }
  return null;
}

const SYMBOLS = ['m', 's', 'rad'];

/** Compact unit text such as "m/s" or "m2". Empty for plain numbers. */
export function formatDim(d: Dim): string {
  const known = literalUnitFor(d);
  if (known !== null) return known;
  const part = (sign: number) =>
    d
      .map((e, i) => (Math.sign(e) === sign ? SYMBOLS[i] + (Math.abs(e) === 1 ? '' : String(Math.abs(e))) : ''))
      .filter(Boolean)
      .join('*');
  const top = part(1) || '1';
  const bottom = part(-1);
  return bottom ? `${top}/${bottom}` : top;
}

const WORDS: ReadonlyMap<string, string> = new Map([
  ['', 'a plain number'],
  ['m', 'meters'],
  ['s', 'seconds'],
  ['rad', 'radians'],
  ['m/s', 'meters per second'],
  ['m/s2', 'meters per second squared'],
  ['1/m', 'units of 1/m'],
]);

/** Unit in words for messages, such as "meters per second". */
export function dimWords(d: Dim): string {
  const text = formatDim(d);
  return WORDS.get(text) ?? `units of ${text}`;
}
