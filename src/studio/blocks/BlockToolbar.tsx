'use client';

import { Copy, GripVertical, StickyNote, Trash2 } from 'lucide-react';
import { Tooltip } from '@/ui/primitives/Tooltip';

interface Props {
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onNote: (() => void) | null;
  onDuplicate: () => void;
  onDelete: () => void;
}

const ICON = 'inline-flex size-6 items-center justify-center rounded text-subtle hover:bg-surface-3 hover:text-fg [&_svg]:size-3.5';

/**
 * The actions on a statement. They fade in on hover or keyboard focus so
 * a long script still reads as clean text. The grip is the drag handle,
 * which keeps text inside the block selectable.
 */
export function BlockToolbar({ onDragStart, onDragEnd, onNote, onDuplicate, onDelete }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      {onNote && (
        <Tooltip content="Add a note">
          <button type="button" className={ICON} onClick={onNote} aria-label="Add a note">
            <StickyNote />
          </button>
        </Tooltip>
      )}
      <Tooltip content="Duplicate" shortcut="Ctrl D">
        <button type="button" className={ICON} onClick={onDuplicate} aria-label="Duplicate block">
          <Copy />
        </button>
      </Tooltip>
      <Tooltip content="Delete" shortcut="Del">
        <button type="button" className={ICON} onClick={onDelete} aria-label="Delete block">
          <Trash2 />
        </button>
      </Tooltip>
      <span draggable onDragStart={onDragStart} onDragEnd={onDragEnd} className={`${ICON} cursor-grab active:cursor-grabbing`} aria-hidden="true" title="Drag to move">
        <GripVertical />
      </span>
    </div>
  );
}
