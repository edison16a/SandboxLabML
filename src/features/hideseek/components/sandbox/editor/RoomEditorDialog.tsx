'use client';

import { Info, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { EditorBoard } from './EditorBoard';
import { EditorSidebar } from './EditorSidebar';
import { EDITOR_TOOLS, KEYBOARD_HINT, toolForKey, type EditorTool } from './editorTools';
import { useRoomDraft } from './useRoomDraft';

interface Props {
  /** The room to edit; the dialog is open while this is set. */
  room: SandboxRoom;
  /** Whether the room is already saved, which offers Delete. */
  saved: boolean;
  onSave: (room: SandboxRoom) => void;
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
  const board = useRef<SVGSVGElement>(null);
  const info = EDITOR_TOOLS.find((t) => t.id === tool)!;

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
      <Button variant="primary" onClick={() => onSave({ ...draft.room, name: draft.room.name.trim() || 'Custom room' })}>
        Save and play
      </Button>
    </div>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Room editor"
      description="Build a room for the Sandbox. Every trained model can play in it."
      footer={footer}
      className="max-w-[980px]"
    >
      <div className="flex flex-col gap-5 md:flex-row" onKeyDown={onKeyDown}>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="mx-auto w-full max-w-[min(62vh,640px)]">
            <EditorBoard ref={board} draft={draft} tool={tool} plankYaw={plankYaw} />
          </div>
          <p role="status" className={`flex min-h-5 items-start gap-1.5 text-[12px] ${draft.notice ? 'text-warn' : 'text-fg/80'}`}>
            {draft.notice ? <TriangleAlert className="mt-px size-3.5 shrink-0" /> : <Info className="mt-px size-3.5 shrink-0 text-muted" />}
            {draft.notice ?? info.hint}
          </p>
          <p className="text-[11px] text-subtle">{KEYBOARD_HINT}</p>
        </div>
        <EditorSidebar draft={draft} tool={tool} onTool={setTool} plankYaw={plankYaw} onPlankYaw={setPlankYaw} />
      </div>
    </Dialog>
  );
}
