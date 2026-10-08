'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ScriptBlock } from '@/engine/script';
import { Button } from '@/ui/primitives/Button';
import { useBlocks } from './BlocksContext';
import { BlockNote } from './BlockNote';
import { insertBlock, removeBlock, updateBlock } from './model/ops';
import { ROOT_LIST } from './model/paths';
import { StatementList, allEntries } from './StatementList';

const HINTS: Record<string, string> = {
  top: 'Sensors and constants',
  tick: 'Every agent, 30 times a second',
  generation: 'Once after each generation',
};

function SectionFrame({ title, hint, actions, children }: { title: string; hint: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface" aria-label={title}>
      <header className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border px-3 py-1.5">
        <h3 className="font-mono text-[13px] font-semibold text-accent">{title}</h3>
        <span className="text-[12px] text-muted">{hint}</span>
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** The top level: sensors and constants, which keep their places among the each sections in the text. */
export function TopSection() {
  const { ws } = useBlocks();
  const entries = ws.items.map((block, index) => ({ block, index })).filter((e) => e.block.type !== 'each');
  const firstEach = ws.items.findIndex((b) => b.type === 'each');
  const end = entries.length > 0 ? entries[entries.length - 1].index + 1 : firstEach === -1 ? ws.items.length : firstEach;
  return (
    <SectionFrame title="top level" hint={HINTS.top}>
      <StatementList addr={ROOT_LIST} entries={entries} scope="top" endIndex={end} />
    </SectionFrame>
  );
}

/** One `each tick` or `each generation` section with its statements. */
export function EachSection({ block, index }: { block: ScriptBlock; index: number }) {
  const { readOnly, apply } = useBlocks();
  const event = String(block.fields.event);
  const path = [{ list: 'items', index }];
  return (
    <div>
      {block.comment !== null && <BlockNote text={block.comment} readOnly={readOnly} onCommit={(text) => apply((ws) => updateBlock(ws, path, (b) => ({ ...b, comment: text })))} />}
      <SectionFrame
        title={`each ${event}`}
        hint={HINTS[event] ?? ''}
        actions={
          !readOnly && (
            <Button size="icon-sm" variant="ghost" aria-label={`Delete each ${event}`} title="Delete this section" onClick={() => apply((ws) => ({ ws: removeBlock(ws, path), select: null }))}>
              <Trash2 />
            </Button>
          )
        }
      >
        <StatementList addr={{ parent: path, list: 'body' }} entries={allEntries(block.children.body)} scope={event === 'generation' ? 'generation' : 'tick'} />
      </SectionFrame>
    </div>
  );
}

/** Buttons that add the each sections a script does not have yet. */
export function AddSections() {
  const { ws, readOnly, apply } = useBlocks();
  if (readOnly) return null;
  const missing = (['tick', 'generation'] as const).filter((e) => !ws.items.some((b) => b.type === 'each' && b.fields.event === e));
  if (missing.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {missing.map((event) => (
        <Button
          key={event}
          variant="outline"
          onClick={() => apply((ws) => insertBlock(ws, ROOT_LIST, ws.items.length, { id: `new-each-${event}`, type: 'each', fields: { event }, inputs: [], children: { body: [] }, comment: null, meta: { blankBefore: true } }))}
        >
          <Plus />
          Add each {event}
        </Button>
      ))}
    </div>
  );
}
