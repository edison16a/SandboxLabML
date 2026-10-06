import type { BlockWorkspace, ParamDef, ScriptBlock } from '@/engine/script';
import { setInput, updateBlock } from './ops';
import type { BlockPath } from './paths';

/**
 * A place a value can go: an input of some block. `index` is null for an
 * optional argument the block does not have yet, which is added on first
 * use. Slots are what pills edit and what value drags drop onto.
 */
export interface Slot {
  owner: BlockPath;
  name: string;
  index: number | null;
  /** May be left out entirely, like a reward's `when` or an optional argument. */
  removable: boolean;
  /** Shown in an empty slot, such as "condition" or the parameter name. */
  hint: string;
  /** Allowed texts for a string parameter, such as built-in track ids. */
  choices?: readonly string[];
  /** Fields of a record parameter, such as the rates inside `mutate: { ... }`. */
  fields?: readonly ParamDef[];
}

/** Path of the value in a slot, for nested pills. Null while the input does not exist yet. */
export function slotPath(slot: Slot): BlockPath | null {
  return slot.index === null ? null : [...slot.owner, { input: slot.index }];
}

const ARGUMENT_OWNERS = new Set(['call', 'callValue', 'settings']);

/**
 * Puts a value in a slot. Clearing a removable call argument drops it, so
 * the call falls back to the default instead of printing a blank.
 */
export function fillSlot(ws: BlockWorkspace, slot: Slot, value: ScriptBlock | null): BlockWorkspace {
  if (value === null && slot.removable) {
    return updateBlock(ws, slot.owner, (b) => (ARGUMENT_OWNERS.has(b.type) ? { ...b, inputs: b.inputs.filter((i) => i.name !== slot.name) } : { ...b, inputs: b.inputs.map((i) => (i.name === slot.name ? { ...i, block: null } : i)) }));
  }
  if (slot.index === null) return value ? setInput(ws, slot.owner, slot.name, value) : ws;
  const index = slot.index;
  return updateBlock(ws, slot.owner, (b) => ({ ...b, inputs: b.inputs.map((i, n) => (n === index ? { ...i, block: value } : i)) }));
}
