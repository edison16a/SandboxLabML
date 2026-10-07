'use client';

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Undo2 } from 'lucide-react';
import { SANDBOX_LIMITS } from '@/engine/hideseek/sandbox/room';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Kbd } from '@/ui/primitives/Kbd';
import { Segmented } from '@/ui/primitives/Segmented';
import { EDITOR_TOOLS, TURN_KEY, type EditorTool, type PlaceYaws } from './editorTools';
import type { RoomDraft } from './useRoomDraft';

interface Props {
  draft: RoomDraft;
  tool: EditorTool;
  onTool: (tool: EditorTool) => void;
  yaws: PlaceYaws;
  onYaws: (yaws: PlaceYaws) => void;
}

const DOT: Partial<Record<EditorTool, string>> = { hiders: 'text-hider', seekers: 'text-seeker' };

/** A ramp's yaw points uphill: yaw 0 is to the right on the board, and each quarter turn goes counterclockwise. */
const UPHILL = [
  { value: '0', label: <ArrowRight />, title: 'Uphill to the right' },
  { value: '1', label: <ArrowUp />, title: 'Uphill to the top' },
  { value: '2', label: <ArrowLeft />, title: 'Uphill to the left' },
  { value: '3', label: <ArrowDown />, title: 'Uphill to the bottom' },
] as const;

/** One "which way" row: a label, the turn key when it applies to this row, and the choice. */
function DirectionRow({ label, turns, children }: { label: string; turns: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12px] text-muted">
      <span className="flex items-center gap-1.5">
        {label}
        {turns && <Kbd>{TURN_KEY}</Kbd>}
      </span>
      {children}
    </div>
  );
}

/** The editor's side column: the room's name, the tools with their keys, which way new planks and ramps go, counts, undo and clear. */
export function EditorSidebar({ draft, tool, onTool, yaws, onYaws }: Props) {
  const room = draft.room;
  return (
    <div className="flex w-full flex-col gap-4 md:w-56">
      <Field label="Name">
        <TextInput value={room.name} maxLength={40} onChange={(e) => draft.rename(e.target.value)} placeholder="Custom room" />
      </Field>
      <div role="radiogroup" aria-label="Tool" className="flex flex-col gap-0.5">
        <span className="mb-1 text-[12px] font-medium text-muted">Tool</span>
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
                'flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-accent',
                on ? 'bg-accent-soft text-fg ring-1 ring-accent/50' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon className={cn('size-4', DOT[t.id])} />
              <span className="flex-1 text-left">{t.label}</span>
              <Kbd>{t.key}</Kbd>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <DirectionRow label="New planks" turns={tool !== 'ramp'}>
          <Segmented
            label="New plank direction"
            size="sm"
            value={yaws.plank === 0 ? 'across' : 'down'}
            onChange={(v) => onYaws({ ...yaws, plank: v === 'across' ? 0 : Math.PI / 2 })}
            options={[
              { value: 'across', label: 'Across' },
              { value: 'down', label: 'Down' },
            ]}
          />
        </DirectionRow>
        <DirectionRow label="New ramps" turns={tool === 'ramp'}>
          <Segmented label="New ramp uphill direction" size="sm" value={String(Math.round(yaws.ramp / (Math.PI / 2)) % 4)} onChange={(v) => onYaws({ ...yaws, ramp: (Number(v) * Math.PI) / 2 })} options={UPHILL} />
        </DirectionRow>
      </div>
      <dl className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-2 p-2.5 text-[12px]">
        <div>
          <dt className="text-subtle">Walls</dt>
          <dd className="tabular font-mono text-fg">
            {room.walls.length}
            <span className="text-subtle"> / {SANDBOX_LIMITS.walls}</span>
          </dd>
        </div>
        <div>
          <dt className="text-subtle">Boxes</dt>
          <dd className="tabular font-mono text-fg">
            {room.boxes.length}
            <span className="text-subtle"> / {SANDBOX_LIMITS.boxes}</span>
          </dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={draft.undo} disabled={!draft.canUndo} aria-label="Undo">
          <Undo2 />
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 justify-center"
          onClick={() => draft.apply({ ...room, walls: [], boxes: [] })}
          disabled={!room.walls.length && !room.boxes.length}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
