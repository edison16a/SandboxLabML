import type { BlockWorkspace, ScriptBlock } from '@/engine/script';
import { blockAt, childPath, isPrefix, listAt, shiftPath, splitPath, type BlockPath, type ListAddress, type PathStep } from './paths';

/**
 * Edits on the block tree. Every function returns a new workspace and
 * leaves the old one alone, copying only the blocks on the way to the edit,
 * so the undo stack and React can compare by reference.
 */

const TOP_LEVEL = new Set(['sensor', 'let', 'each']);
const STATEMENTS = new Set(['let', 'reward', 'stop', 'if', 'repeat', 'forEach', 'call', 'expression']);

/** Whether a block may sit in a list: sensors and each blocks only at the top, statements only inside blocks. */
export function canDrop(block: ScriptBlock, addr: ListAddress): boolean {
  return addr.parent.length === 0 ? TOP_LEVEL.has(block.type) : STATEMENTS.has(block.type);
}

function replaceChild(block: ScriptBlock, s: PathStep, next: ScriptBlock | null): ScriptBlock {
  if ('list' in s) {
    const list = [...(block.children[s.list] ?? [])];
    if (next) list[s.index] = next;
    return { ...block, children: { ...block.children, [s.list]: list } };
  }
  const inputs = block.inputs.map((i, n) => (n === s.input ? { ...i, block: next } : i));
  return { ...block, inputs };
}

/** Replaces the block at `path` with what `fn` returns. Unknown paths leave the workspace unchanged. */
export function updateBlock(ws: BlockWorkspace, path: BlockPath, fn: (b: ScriptBlock) => ScriptBlock): BlockWorkspace {
  const target = blockAt(ws, path);
  if (!target) return ws;
  let next = fn(target);
  for (let depth = path.length - 1; depth > 0; depth--) {
    const parent = blockAt(ws, path.slice(0, depth));
    if (!parent) return ws;
    next = replaceChild(parent, path[depth], next);
  }
  const first = path[0] as { list: string; index: number };
  const items = [...ws.items];
  items[first.index] = next;
  return normalize({ ...ws, items });
}

/** Replaces a whole statement list. */
export function updateList(ws: BlockWorkspace, addr: ListAddress, fn: (list: ScriptBlock[]) => ScriptBlock[]): BlockWorkspace {
  if (addr.parent.length === 0) return normalize({ ...ws, items: fn([...ws.items]) });
  return updateBlock(ws, addr.parent, (b) => ({ ...b, children: { ...b.children, [addr.list]: fn([...(b.children[addr.list] ?? [])]) } }));
}

export function insertBlock(ws: BlockWorkspace, addr: ListAddress, index: number, block: ScriptBlock): BlockWorkspace {
  return updateList(ws, addr, (list) => {
    list.splice(Math.max(0, Math.min(index, list.length)), 0, block);
    return list;
  });
}

export function removeBlock(ws: BlockWorkspace, path: BlockPath): BlockWorkspace {
  const at = splitPath(path);
  if (!at) return ws;
  return updateList(ws, at.addr, (list) => list.filter((_, i) => i !== at.index));
}

/**
 * Moves a statement to `index` of another list (or the same one). Returns
 * the new workspace and the moved block's new path, or null when the move
 * is not allowed, such as dropping an if inside its own body.
 */
export function moveBlock(ws: BlockWorkspace, from: BlockPath, to: ListAddress, index: number): { ws: BlockWorkspace; path: BlockPath } | null {
  const block = blockAt(ws, from);
  const src = splitPath(from);
  const dest = listAt(ws, to);
  if (!block || !src || !dest || isPrefix(from, to.parent) || !canDrop(block, to)) return null;
  const inserted = insertBlock(ws, to, index, block);
  const fromNow = shiftPath(from, to, index, 1);
  const removed = removeBlock(inserted, fromNow);
  const landed = shiftPath(childPath(to, Math.min(index, dest.length)), src.addr, splitPath(fromNow)!.index, -1);
  return { ws: removed, path: landed };
}

/** Puts a copy of a statement right after it. */
export function duplicateBlock(ws: BlockWorkspace, path: BlockPath): BlockWorkspace {
  const block = blockAt(ws, path);
  const at = splitPath(path);
  if (!block || !at) return ws;
  return insertBlock(ws, at.addr, at.index + 1, structuredClone(block));
}

/** Sets a value input by name, adding the input at the end when the block does not have it yet. */
export function setInput(ws: BlockWorkspace, path: BlockPath, name: string, value: ScriptBlock | null): BlockWorkspace {
  return updateBlock(ws, path, (b) => {
    const has = b.inputs.some((i) => i.name === name);
    const inputs = has ? b.inputs.map((i) => (i.name === name ? { ...i, block: value } : i)) : [...b.inputs, { name, block: value }];
    return { ...b, inputs };
  });
}

/** Drops an optional argument, so the call falls back to the default. */
export function removeInput(ws: BlockWorkspace, path: BlockPath, name: string): BlockWorkspace {
  return updateBlock(ws, path, (b) => ({ ...b, inputs: b.inputs.filter((i) => i.name !== name) }));
}

/**
 * An `else if` chain keeps exactly one if block in its else list. Once
 * someone drops a second block in there, it becomes a plain else with a
 * body, or the printer would quietly drop the extra blocks.
 */
function fixElseIf(b: ScriptBlock): ScriptBlock {
  const children = Object.fromEntries(Object.entries(b.children).map(([k, list]) => [k, list.map(fixElseIf)]));
  const elseList = children.else;
  const ok = elseList !== undefined && elseList.length === 1 && elseList[0].type === 'if';
  const fields = b.fields.elseIf === true && !ok ? { ...b.fields, elseIf: false } : b.fields;
  return { ...b, fields, children };
}

export function normalize(ws: BlockWorkspace): BlockWorkspace {
  return { ...ws, items: ws.items.map(fixElseIf) };
}
