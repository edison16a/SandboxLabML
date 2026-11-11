'use client';

import { RotateCw, Undo2 } from 'lucide-react';
import { COURSE_LIMITS, SANDBOX_LENGTHS } from '@/engine/navigation/course/sandbox';
import { setLength } from '@/engine/navigation/course/edit';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Kbd } from '@/ui/primitives/Kbd';
import { Segmented } from '@/ui/primitives/Segmented';
import { EDITOR_TOOLS, TURN_KEY, type EditorTool, type PlaceOptions } from './editorTools';
import type { CourseDraft } from './useCourseDraft';

/** The lengths offered: the editor's own, plus the course's own when it is another (a copy of a named course can be 28, 38 or 46 m). */
function lengthChoices(...own: number[]): number[] {
  return [...new Set([...SANDBOX_LENGTHS, ...own])].sort((a, b) => a - b);
}

/** A shorter room drops what no longer fits. Undo brings it back, and the hint line says so. */
function resize(draft: CourseDraft, length: number): void {
  const next = setLength(draft.spec, length);
  const dropped = draft.spec.obstacles.length - next.obstacles.length;
  draft.apply(next);
  if (dropped === 1) draft.flash('1 piece did not fit and was removed. Undo brings it back.');
  else if (dropped > 1) draft.flash(`${dropped} pieces did not fit and were removed. Undo brings them back.`);
}

/** The name, the room length, undo and clear, above the board. `opened` is the length the course came in with, which stays on offer. */
export function EditorHeader({ draft, opened }: { draft: CourseDraft; opened: number }) {
  const spec = draft.spec;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Name" className="min-w-[180px] flex-1">
        <TextInput value={spec.name} maxLength={COURSE_LIMITS.nameLength} onChange={(e) => draft.rename(e.target.value)} placeholder="My course" />
      </Field>
      <Field label="Length">
        <Segmented
          label="Room length"
          size="sm"
          value={String(spec.length)}
          onChange={(v) => resize(draft, Number(v))}
          options={lengthChoices(opened, spec.length).map((l) => ({ value: String(l), label: `${l} m` }))}
        />
      </Field>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={draft.undo} disabled={!draft.canUndo}>
          <Undo2 />
          Undo
        </Button>
        <Button variant="outline" size="sm" onClick={() => draft.apply({ ...spec, obstacles: [], level: 0 })} disabled={!spec.obstacles.length}>
          Clear
        </Button>
      </div>
    </div>
  );
}

/** The tools as one row of buttons, each with its key. */
export function ToolRow({ tool, onTool }: { tool: EditorTool; onTool: (t: EditorTool) => void }) {
  return (
    <div role="radiogroup" aria-label="Tool" className="flex flex-wrap gap-1">
      {EDITOR_TOOLS.map((t) => {
        const on = t.id === tool;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onTool(t.id)}
            className={cn(
              'flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-accent',
              on ? 'bg-accent-soft text-fg ring-1 ring-accent/50' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <Icon className="size-4" />
            {t.label}
            <Kbd>{t.key}</Kbd>
          </button>
        );
      })}
    </div>
  );
}

/** The choices of the current tool: the next crate's shape and turn, or the next mover's pace. Counts sit at the end. */
export function ToolOptions({ draft, tool, options, onOptions }: { draft: CourseDraft; tool: EditorTool; options: PlaceOptions; onOptions: (o: PlaceOptions) => void }) {
  const pieces = draft.spec.obstacles.length;
  const movers = draft.spec.obstacles.filter((o) => o.kind === 'mover').length;
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-3 text-[12px] text-fg/80">
      {tool === 'block' && (
        <>
          <Segmented
            label="Crate shape"
            size="sm"
            value={options.shape}
            onChange={(shape) => onOptions({ ...options, shape })}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'big', label: 'Big' },
              { value: 'long', label: 'Long' },
            ]}
          />
          <Button variant="outline" size="sm" disabled={options.shape !== 'long'} onClick={() => onOptions({ ...options, turned: !options.turned })} aria-pressed={options.turned}>
            <RotateCw />
            {options.turned ? 'Along' : 'Across'}
            <Kbd>{TURN_KEY}</Kbd>
          </Button>
        </>
      )}
      {tool === 'mover' && (
        <span className="flex items-center gap-2">
          Pace
          <Segmented
            label="Mover pace"
            size="sm"
            value={options.pace}
            onChange={(pace) => onOptions({ ...options, pace })}
            options={[
              { value: 'slow', label: 'Slow' },
              { value: 'medium', label: 'Medium' },
              { value: 'fast', label: 'Fast' },
            ]}
          />
        </span>
      )}
      <span className="flex-1" />
      <span className="tabular font-mono text-[11px] text-subtle">
        {pieces} / {COURSE_LIMITS.obstacles} pieces, {movers} / {COURSE_LIMITS.movers} movers, level {draft.spec.level}
      </span>
    </div>
  );
}
