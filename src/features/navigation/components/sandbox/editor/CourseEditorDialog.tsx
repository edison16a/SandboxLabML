'use client';

import { Info, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CourseSpec } from '@/engine/navigation/course/types';
import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { CourseBoard } from './CourseBoard';
import { EditorHeader, ToolOptions, ToolRow } from './EditorTools';
import { EDITOR_TOOLS, KEYBOARD_HINT, START_OPTIONS, toolForKey, TURN_KEY, type EditorTool, type PlaceOptions } from './editorTools';
import { useBoardInput } from './useBoardInput';
import { useCourseDraft } from './useCourseDraft';

/** Shown after the first Escape or a click outside over unsaved changes. Either way, the next Escape closes. */
const UNSAVED = 'This course has unsaved changes. Save it, or press Escape to close without saving.';
const BLOCKED = 'There is no way from the start to the finish. Open a gap so runners can get through.';

interface Props {
  /** The course to edit; the dialog is open while this is set. */
  course: CourseSpec;
  /** Whether the course is already saved, which offers Delete. */
  saved: boolean;
  /** Stores the course. The parent closes the dialog once it is stored. */
  onSave: (spec: CourseSpec) => Promise<void>;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * The course editor: the room from above on a snapping grid, with tools
 * to place crates, draw walls, spike pads and movers with their paths,
 * move the start and finish lines and erase, plus undo, the room length
 * and a hint line for the current tool. It refuses to save a course with
 * no way through. Saving stores the course and runs it at once.
 */
export function CourseEditorDialog({ course, saved, onSave, onDelete, onClose }: Props) {
  const draft = useCourseDraft(course);
  const [tool, setTool] = useState<EditorTool>('block');
  const [options, setOptions] = useState<PlaceOptions>(START_OPTIONS);
  /** Delete asks once more before it removes a saved course for good. */
  const [confirming, setConfirming] = useState(false);
  /** The draft when Escape last tried to close over unsaved changes. Any edit after it disarms the second press. */
  const [leavingFrom, setLeavingFrom] = useState<CourseSpec | null>(null);
  const input = useBoardInput(draft, tool, options);
  const board = useRef<SVGSVGElement>(null);
  const info = EDITOR_TOOLS.find((t) => t.id === tool)!;
  const leaving = leavingFrom === draft.spec;
  const notice = leaving ? UNSAVED : (draft.notice ?? (draft.solvable ? null : BLOCKED));
  const changed = () => JSON.stringify(draft.spec) !== JSON.stringify(course);

  /** Escape first drops a piece in progress. Over unsaved changes it warns once and closes on the second press. A click outside only warns. */
  const onEscapeKeyDown = (e: KeyboardEvent) => {
    if (input.cancel()) return e.preventDefault();
    if (leaving || !changed()) return;
    e.preventDefault();
    setLeavingFrom(draft.spec);
  };
  const onInteractOutside = (e: Event) => {
    if (!changed()) return;
    e.preventDefault();
    setLeavingFrom(draft.spec);
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
    if (e.key.toLowerCase() === TURN_KEY.toLowerCase()) setOptions((o) => ({ ...o, shape: 'long', turned: o.shape === 'long' ? !o.turned : o.turned }));
  };

  const footer = (
    <div className="flex w-full items-center gap-2">
      {saved && (
        <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => (confirming ? onDelete(course.id) : setConfirming(true))} onBlur={() => setConfirming(false)}>
          {confirming ? 'Click again to delete' : 'Delete course'}
        </Button>
      )}
      <span className="flex-1" />
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" disabled={!draft.solvable} onClick={() => void onSave({ ...draft.spec, name: draft.spec.name.trim() || 'My course' })}>
        Save and play
      </Button>
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} onEscapeKeyDown={onEscapeKeyDown} onInteractOutside={onInteractOutside} title="Course editor" footer={footer} className="max-w-[1080px]">
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        <EditorHeader draft={draft} />
        <ToolRow tool={tool} onTool={setTool} />
        <CourseBoard ref={board} draft={draft} input={input} tool={tool} options={options} />
        <p role="status" className={`flex min-h-[1.4em] items-start gap-1.5 text-[12px] leading-[1.3] ${notice ? 'text-warn' : 'text-fg/80'}`}>
          {notice ? <TriangleAlert className="mt-px size-3.5 shrink-0" /> : <Info className="mt-px size-3.5 shrink-0 text-muted" />}
          {notice ?? info.hint}
        </p>
        <ToolOptions draft={draft} tool={tool} options={options} onOptions={setOptions} />
        <p className="text-[11px] text-subtle">{KEYBOARD_HINT}</p>
      </div>
    </Dialog>
  );
}
