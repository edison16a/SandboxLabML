import type { ScriptBlock } from '@/engine/script';
import type { BlockPath } from './paths';

/** What is being dragged: a fresh block from the palette, or a statement already in the workspace. */
export type DragPayload = { kind: 'palette'; block: ScriptBlock } | { kind: 'move'; path: BlockPath; block: ScriptBlock };

/**
 * The drag in progress. Browsers hide dataTransfer contents during
 * dragover, so drop targets could not tell a statement from a value while
 * hovering. Keeping the payload here lets each gap and slot decide whether
 * to light up before the drop.
 */
let current: DragPayload | null = null;

export function startDrag(e: React.DragEvent, payload: DragPayload, label: string): void {
  current = payload;
  e.dataTransfer.effectAllowed = payload.kind === 'move' ? 'move' : 'copy';
  // Firefox only starts a drag when some data is set.
  e.dataTransfer.setData('text/plain', label);
  e.stopPropagation();
}

export function endDrag(): void {
  current = null;
}

export function currentDrag(): DragPayload | null {
  return current;
}

const VALUE_TYPES = new Set(['number', 'text', 'boolean', 'name', 'unary', 'binary', 'callValue', 'settings']);

export function isValueBlock(b: ScriptBlock): boolean {
  return VALUE_TYPES.has(b.type);
}
