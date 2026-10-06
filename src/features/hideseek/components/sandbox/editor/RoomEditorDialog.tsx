'use client';

import { Info, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { EditorBoard } from './EditorBoard';
import { EditorSidebar } from './EditorSidebar';
import { EDITOR_TOOLS, KEYBOARD_HINT, toolForKey, type EditorTool } from './editorTools';
import { useBoardInput } from './useBoardInput';
import { useRoomDraft } from './useRoomDraft';

/** Shown after the first Escape or a click outside over unsaved changes. Either way, the next Escape closes. */
const UNSAVED = 'This room has unsaved changes. Save it, or press Escape to close without saving.';

interface Props {
  /** The room to edit; the dialog is open while this is set. */
  room: SandboxRoom;
  /** Whether the room is already saved, which offers Delete. */
  saved: boolean;
  /** Stores the room. The parent closes the dialog once it is stored. */
  onSave: (room: SandboxRoom) => Promise<void>;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * The room editor: a top down board on a snapping grid with tools to draw
 * walls, place cubes and planks, erase, and set where each team spawns,
 * plus undo, clear and a hint line that says what the current tool does.
 * Saving stores the room and plays it straight away.
 */
export function RoomEditorDialog({ room, saved, onSave, onDelete, onClose }: Props) {
  const draft = useRoomDraft(room);
  const [tool, setTool] = useState<EditorTool>('wall');
  const [plankYaw, setPlankYaw] = useState(0);
  /** Delete asks once more before it removes a saved room for good. */
  const [confirming, setConfirming] = useState(false);
  /** The draft when Escape last tried to close over unsaved changes. Any edit after it disarms the second press. */
  const [leavingFrom, setLeavingFrom] = useState<SandboxRoom | null>(null);
  const input = useBoardInput(draft, tool, plankYaw);
  const board = useRef<SVGSVGElement>(null);
  const info = EDITOR_TOOLS.find((t) => t.id === tool)!;
  const leaving = leavingFrom === draft.room;
  const notice = leaving ? UNSAVED : draft.notice;
  const changed = () => JSON.stringify(draft.room) !== JSON.stringify(room);

  /**
   * Escape first drops a wall or drag in progress. Over unsaved changes it
   * warns once and closes on the second press. A click outside never throws
   * edits away: it shows the same warning instead.
   */
  const onEscapeKeyDown = (e: KeyboardEvent) => {
    if (input.cancel()) return e.preventDefault();
    if (leaving || !changed()) return;
    e.preventDefault();
    setLeavingFrom(draft.room);
  };
  const onInteractOutside = (e: Event) => {
    if (!changed()) return;
    e.preventDefault();
    setLeavingFrom(draft.room);
  };

  useEffect(() => {
    // Focus the board once the dialog has opened, so the keys work at once.
    const id = setTimeout(() => board.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(id);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const typing = (e.target as HTMLElement).tagName === 'INPUT';
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      return draft.undo();
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    const next = toolForKey(e.key);
    if (next) return setTool(next);
    if (e.key.toLowerCase() === 'r') setPlankYaw((y) => (y === 0 ? Math.PI / 2 : 0));
  };

  const footer = (
    <div className="flex w-full items-center gap-2">
      {saved && (
        <Button
          variant="ghost"
          className="text-danger hover:text-danger"
          onClick={() => (confirming ? onDelete(room.id) : setConfirming(true))}
          onBlur={() => setConfirming(false)}
        >
          {confirming ? 'Click again to delete' : 'Delete room'}
        </Button>
      )}
      <span className="flex-1" />
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={() => void onSave({ ...draft.room, name: draft.room.name.trim() || 'Custom room' })}>
        Save and play
      </Button>
    </div>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      onEscapeKeyDown={onEscapeKeyDown}
      onInteractOutside={onInteractOutside}
      title="Room editor"
      description="Build a room for the Sandbox. Every trained model can play in it."
      footer={footer}
      className="max-w-[980px]"
    >
      <div className="flex flex-col gap-5 md:flex-row" onKeyDown={onKeyDown}>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="mx-auto w-full max-w-[min(62vh,640px)]">
            <EditorBoard ref={board} draft={draft} input={input} tool={tool} plankYaw={plankYaw} />
          </div>
          <p role="status" className={`flex min-h-[2.6em] items-start gap-1.5 text-[12px] leading-[1.3] ${notice ? 'text-warn' : 'text-fg/80'}`}>
            {notice ? <TriangleAlert className="mt-px size-3.5 shrink-0" /> : <Info className="mt-px size-3.5 shrink-0 text-muted" />}
            {notice ?? info.hint}
          </p>
          <p className="text-[11px] text-subtle">{KEYBOARD_HINT}</p>
        </div>
        <EditorSidebar draft={draft} tool={tool} onTool={setTool} plankYaw={plankYaw} onPlankYaw={setPlankYaw} />
      </div>
    </Dialog>
  );
}
