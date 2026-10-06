'use client';

import { useState } from 'react';
import { cn } from '@/ui/cn';
import { useBlocks } from './BlocksContext';
import { currentDrag, endDrag } from './model/drag';
import { canDrop, insertBlock, moveBlock } from './model/ops';
import { childPath, type ListAddress } from './model/paths';

interface Props {
  addr: ListAddress;
  index: number;
  /** A taller target with a hint, for an empty list. */
  empty?: boolean;
}

/**
 * A thin target between two statements. It lights up only for blocks that
 * may live in this list, so dragging a sensor over each tick shows nothing.
 */
export function DropGap({ addr, index, empty = false }: Props) {
  const { readOnly, apply } = useBlocks();
  const [over, setOver] = useState(false);
  const accepts = () => {
    const d = currentDrag();
    return !readOnly && d !== null && canDrop(d.block, addr);
  };
  return (
    <div
      onDragOver={(e) => {
        if (!accepts()) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const d = currentDrag();
        if (!d || !accepts()) return;
        e.preventDefault();
        e.stopPropagation();
        endDrag();
        if (d.kind === 'palette') {
          apply((ws) => ({ ws: insertBlock(ws, addr, index, structuredClone(d.block)), select: childPath(addr, index) }));
          return;
        }
        apply((ws) => {
          const moved = moveBlock(ws, d.path, addr, index);
          return moved ? { ws: moved.ws, select: moved.path } : ws;
        });
      }}
      className={cn(
        'relative transition-all',
        empty ? 'flex h-11 items-center justify-center rounded-md border border-dashed text-[12px] text-subtle' : 'h-1.5',
        empty && (over ? 'border-accent bg-accent-soft text-fg' : 'border-border'),
      )}
    >
      {empty && (readOnly ? 'Nothing here yet' : 'Drag blocks here')}
      {!empty && over && <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accent" />}
    </div>
  );
}
