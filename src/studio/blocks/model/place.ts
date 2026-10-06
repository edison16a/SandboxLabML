import type { BlockWorkspace, ScriptBlock } from '@/engine/script';
import { canDrop, insertBlock } from './ops';
import type { PaletteScope } from './palette';
import { childPath, ROOT_LIST, splitPath, type BlockPath, type ListAddress } from './paths';

/** The section a path lives in: the top level, or the each block at its first step. */
export function scopeOfPath(ws: BlockWorkspace, path: BlockPath): PaletteScope {
  const first = path[0];
  if (!first || !('list' in first)) return 'top';
  const item = ws.items[first.index];
  if (item?.type !== 'each' || path.length < 2) return 'top';
  return item.fields.event === 'generation' ? 'generation' : 'tick';
}

function eachIndex(ws: BlockWorkspace, event: 'tick' | 'generation'): number {
  return ws.items.findIndex((b) => b.type === 'each' && b.fields.event === event);
}

/**
 * Where a clicked palette block goes: right after the selected statement
 * when that is in the same section, otherwise at the end of the section.
 * A missing each section is created around the block. Returns the new
 * workspace and the block's path, so it can be selected.
 */
export function placeBlock(ws: BlockWorkspace, block: ScriptBlock, scope: PaletteScope, selected: BlockPath | null): { ws: BlockWorkspace; select: BlockPath } {
  if (block.type === 'each') {
    const existing = eachIndex(ws, block.fields.event === 'generation' ? 'generation' : 'tick');
    if (existing !== -1) return { ws, select: [{ list: 'items', index: existing }] };
    return { ws: insertBlock(ws, ROOT_LIST, ws.items.length, block), select: [{ list: 'items', index: ws.items.length }] };
  }
  const at = selected ? splitPath(selected) : null;
  if (selected && at && scopeOfPath(ws, selected) === scope && canDrop(block, at.addr)) {
    return { ws: insertBlock(ws, at.addr, at.index + 1, block), select: childPath(at.addr, at.index + 1) };
  }
  if (scope === 'top') {
    let lastTop = -1;
    ws.items.forEach((b, i) => {
      if (b.type !== 'each') lastTop = i;
    });
    const firstEach = ws.items.findIndex((b) => b.type === 'each');
    const index = lastTop !== -1 ? lastTop + 1 : firstEach !== -1 ? firstEach : ws.items.length;
    return { ws: insertBlock(ws, ROOT_LIST, index, block), select: childPath(ROOT_LIST, index) };
  }
  const i = eachIndex(ws, scope);
  if (i === -1) {
    const section: ScriptBlock = { id: `new-each-${scope}`, type: 'each', fields: { event: scope }, inputs: [], children: { body: [block] }, comment: null, meta: { blankBefore: true } };
    return { ws: insertBlock(ws, ROOT_LIST, ws.items.length, section), select: [{ list: 'items', index: ws.items.length }, { list: 'body', index: 0 }] };
  }
  const addr: ListAddress = { parent: [{ list: 'items', index: i }], list: 'body' };
  const length = ws.items[i].children.body?.length ?? 0;
  return { ws: insertBlock(ws, addr, length, block), select: childPath(addr, length) };
}
