import { dimWords, isUnitless, UNITLESS, type Dim } from './units';

/**
 * The value kinds a script can work with. There are no user objects or
 * arrays: records only appear as literal operator arguments such as
 * `mutate: { weights: 0.8 }`, and strings only as names like stop reasons.
 * `error` marks an expression that already failed, so one mistake does not
 * cascade into a page of follow-up errors.
 */
export type ValueKind = 'number' | 'bool' | 'string' | 'record' | 'void' | 'error';

export interface ValueType {
  kind: ValueKind;
  /** Unit of a number. Always unitless for the other kinds. */
  dim: Dim;
}

export const BOOL: ValueType = { kind: 'bool', dim: UNITLESS };
export const STRING: ValueType = { kind: 'string', dim: UNITLESS };
export const RECORD: ValueType = { kind: 'record', dim: UNITLESS };
export const VOID: ValueType = { kind: 'void', dim: UNITLESS };
export const ERROR: ValueType = { kind: 'error', dim: UNITLESS };
export const PLAIN: ValueType = { kind: 'number', dim: UNITLESS };

export function num(dim: Dim): ValueType {
  return { kind: 'number', dim };
}

/** Plain words for messages, such as "a number in meters" or "true or false". */
export function describeType(t: ValueType): string {
  switch (t.kind) {
    case 'number':
      return isUnitless(t.dim) ? 'a plain number' : `a number in ${dimWords(t.dim)}`;
    case 'bool':
      return 'true or false';
    case 'string':
      return 'text';
    case 'record':
      return 'a group of settings';
    case 'void':
      return 'nothing';
    default:
      return 'an unknown value';
  }
}
