import { HOLE, type BinaryOp, type RegistryEntry, type ScriptBlock, type UnaryOp, type UnitName } from '@/engine/script';

let counter = 0;

/** Ids for blocks made in the editor. They only live until the next print and parse, which hands out content ids. */
const freshId = () => `new-${++counter}`;

function value(type: ScriptBlock['type'], fields: ScriptBlock['fields'], inputs: ScriptBlock['inputs'] = []): ScriptBlock {
  return { id: freshId(), type, fields, inputs, children: {}, comment: null };
}

export const numberBlock = (n: number, unit: UnitName = ''): ScriptBlock => value('number', { value: n, unit });
export const nameBlock = (name: string): ScriptBlock => value('name', { name });
export const textBlock = (text: string): ScriptBlock => value('text', { value: text });
export const boolBlock = (b: boolean): ScriptBlock => value('boolean', { value: b });

export function binaryBlock(op: BinaryOp, left: ScriptBlock | null, right: ScriptBlock | null): ScriptBlock {
  return value('binary', { op }, [
    { name: 'left', block: left },
    { name: 'right', block: right },
  ]);
}

export function unaryBlock(op: UnaryOp, operand: ScriptBlock | null): ScriptBlock {
  return value('unary', { op }, [{ name: 'operand', block: operand }]);
}

/**
 * A function call value. A function with one parameter takes it by
 * position, like `abs(x)`, matching how the palette and docs write it.
 * `first` fills the first slot, which is how "wrap in abs" keeps the value
 * that was there.
 */
export function callValueBlock(e: RegistryEntry, first: ScriptBlock | null = null): ScriptBlock {
  const positional = e.params.length === 1;
  const inputs = e.params.filter((p, i) => p.required || i === 0).map((p, i) => ({ name: positional ? '' : p.name, block: i === 0 ? first : null }));
  return value('callValue', { name: e.name }, inputs);
}

/** An empty slot, or one holding the `_` placeholder the printer writes for empty slots. */
export function isEmptySlot(b: ScriptBlock | null): boolean {
  return b === null || (b.type === 'name' && b.fields.name === HOLE);
}

export const COMPARE_OPS: readonly BinaryOp[] = ['>', '<', '>=', '<=', '==', '!='];
export const MATH_OPS: readonly BinaryOp[] = ['+', '-', '*', '/', '%'];
export const LOGIC_OPS: readonly BinaryOp[] = ['and', 'or'];

/** Operators shown together in the picker: swapping > for < keeps meaning in the same family. */
export function opFamily(op: string): readonly BinaryOp[] {
  if (COMPARE_OPS.includes(op as BinaryOp)) return COMPARE_OPS;
  if (MATH_OPS.includes(op as BinaryOp)) return MATH_OPS;
  return LOGIC_OPS;
}

export const UNIT_CHOICES: ReadonlyArray<{ value: UnitName; label: string }> = [
  { value: '', label: 'no unit' },
  { value: 'm', label: 'm' },
  { value: 's', label: 's' },
  { value: 'm/s', label: 'm/s' },
  { value: 'm/s2', label: 'm/s2' },
  { value: 'deg', label: 'deg' },
  { value: 'rad', label: 'rad' },
  { value: '1/m', label: '1/m' },
  { value: '%', label: '%' },
];
