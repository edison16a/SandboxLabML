'use client';

import { useMemo } from 'react';
import { useBlocks } from './BlocksContext';
import { duplicateBlock, moveBlock, removeBlock, updateBlock } from './model/ops';
import { childPath, listAt, splitPath, type BlockPath } from './model/paths';

/** Delete, duplicate, move and note actions for one statement, shared by its toolbar and its keyboard shortcuts. */
export function useBlockActions(path: BlockPath) {
  const { apply } = useBlocks();
  return useMemo(() => {
    const at = splitPath(path);
    return {
      remove: () => apply((ws) => ({ ws: removeBlock(ws, path), select: null })),
      duplicate: () => at && apply((ws) => ({ ws: duplicateBlock(ws, path), select: childPath(at.addr, at.index + 1) })),
      /** One step up (-1) or down (1) within the same list. Moving down inserts two places on, since the block itself is removed afterwards. */
      move: (delta: -1 | 1) =>
        at &&
        apply((ws) => {
          const list = listAt(ws, at.addr) ?? [];
          const target = delta < 0 ? at.index - 1 : at.index + 2;
          if (target < 0 || target > list.length) return ws;
          const moved = moveBlock(ws, path, at.addr, target);
          return moved ? { ws: moved.ws, select: moved.path } : ws;
        }),
      setNote: (text: string | null) => apply((ws) => updateBlock(ws, path, (b) => ({ ...b, comment: text }))),
    };
  }, [apply, path]);
}

/** Moves keyboard focus to the previous or next block on the canvas, in reading order. */
export function focusNeighbor(from: HTMLElement, delta: -1 | 1): void {
  const all = Array.from(document.querySelectorAll<HTMLElement>('[data-block]'));
  const next = all[all.indexOf(from) + delta];
  next?.focus();
}
