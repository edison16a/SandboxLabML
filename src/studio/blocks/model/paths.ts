import type { BlockWorkspace, ScriptBlock } from '@/engine/script';

/**
 * Where a block lives, as steps from the workspace root: into a statement
 * list such as `items` or `body`, or into a value input by position. Paths
 * are used instead of ids because ids follow a block's content, so they
 * change on every edit, while a path stays put.
 */
export type PathStep = { list: string; index: number } | { input: number };
export type BlockPath = readonly PathStep[];

/** A statement list: the block that owns it (empty for the root) and the list's name. */
export interface ListAddress {
  parent: BlockPath;
  list: string;
}

export const ROOT_LIST: ListAddress = { parent: [], list: 'items' };

export function pathKey(path: BlockPath): string {
  return path.map((s) => ('list' in s ? `${s.list}.${s.index}` : `in.${s.input}`)).join('/');
}

export function sameStep(a: PathStep, b: PathStep): boolean {
  if ('list' in a) return 'list' in b && a.list === b.list && a.index === b.index;
  return 'input' in b && a.input === b.input;
}

export function isPrefix(prefix: BlockPath, path: BlockPath): boolean {
  return prefix.length <= path.length && prefix.every((s, i) => sameStep(s, path[i]));
}

/** The list a statement path ends in, and its index there. Null for value paths. */
export function splitPath(path: BlockPath): { addr: ListAddress; index: number } | null {
  const last = path[path.length - 1];
  if (!last || !('list' in last)) return null;
  return { addr: { parent: path.slice(0, -1), list: last.list }, index: last.index };
}

export function childPath(addr: ListAddress, index: number): BlockPath {
  return [...addr.parent, { list: addr.list, index }];
}

function step(block: ScriptBlock, s: PathStep): ScriptBlock | null {
  if ('list' in s) return block.children[s.list]?.[s.index] ?? null;
  return block.inputs[s.input]?.block ?? null;
}

export function blockAt(ws: BlockWorkspace, path: BlockPath): ScriptBlock | null {
  const first = path[0];
  if (!first || !('list' in first) || first.list !== 'items') return null;
  let block: ScriptBlock | null = ws.items[first.index] ?? null;
  for (let i = 1; i < path.length && block; i++) block = step(block, path[i]);
  return block;
}

export function listAt(ws: BlockWorkspace, addr: ListAddress): ScriptBlock[] | null {
  if (addr.parent.length === 0) return addr.list === 'items' ? ws.items : null;
  return blockAt(ws, addr.parent)?.children[addr.list] ?? null;
}

/**
 * Adjusts a path after a block was inserted (delta 1) or removed (delta -1)
 * at `index` of the list `addr`. Paths that run through a later sibling in
 * that list shift by one, everything else is untouched.
 */
export function shiftPath(path: BlockPath, addr: ListAddress, index: number, delta: number): BlockPath {
  const depth = addr.parent.length;
  if (!isPrefix(addr.parent, path) || path.length <= depth) return path;
  const s = path[depth];
  if (!('list' in s) || s.list !== addr.list || s.index < index) return path;
  if (delta < 0 && s.index === index) return path;
  const out = [...path];
  out[depth] = { list: s.list, index: s.index + delta };
  return out;
}
