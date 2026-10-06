'use client';

import { useMemo, useState } from 'react';
import type { EnvId } from '@/engine/env/types';
import type { PaletteItem, ScriptBlock } from '@/engine/script';
import { cn } from '@/ui/cn';
import { TextInput } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { CATEGORY_COLORS } from './model/categories';
import { endDrag, isValueBlock, startDrag } from './model/drag';
import { paletteFor, type PaletteScope } from './model/palette';

interface Props {
  env: EnvId;
  scope: PaletteScope;
  onScope: (scope: PaletteScope) => void;
  /** Adds a statement where the author is working. Values have no place of their own, so they are drag only. */
  onAdd: (block: ScriptBlock) => void;
  disabled: boolean;
  className?: string;
}

/** Shows a label template such as "aim for {target} species" as words with small empty slots named after the parameters. */
function Label({ text }: { text: string }) {
  return (
    <>
      {text.split(/\{(\w+)\}/).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="mx-0.5 rounded border border-dashed border-border-strong px-1 text-[11px] text-subtle">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Item({ item, color, onAdd, disabled }: { item: PaletteItem; color: string; onAdd: Props['onAdd']; disabled: boolean }) {
  const value = isValueBlock(item.template);
  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      onDragStart={(e) => startDrag(e, { kind: 'palette', block: item.template }, item.key)}
      onDragEnd={endDrag}
      onClick={() => !value && onAdd(structuredClone(item.template))}
      title={value ? `${item.summary} Drag it onto a slot.` : `${item.summary} Click to add, or drag into place.`}
      aria-label={value ? `${item.key}, drag onto a slot` : `Add ${item.key}`}
      className={cn(
        'flex w-full items-center gap-2 border border-border bg-surface-2 px-2 py-1 text-left text-[12px] text-fg transition-colors hover:border-border-strong hover:bg-surface-3 disabled:opacity-40',
        value ? 'cursor-grab rounded-full' : 'cursor-pointer rounded-md',
      )}
      style={value ? undefined : { borderLeftWidth: 3, borderLeftColor: color }}
    >
      {value && <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="min-w-0 truncate">
        <Label text={item.label} />
      </span>
    </button>
  );
}

/**
 * Blocks to add, grouped by category, for the section being edited.
 * Statements can be clicked or dragged; values are dragged onto a slot.
 */
export function Palette({ env, scope, onScope, onAdd, disabled, className }: Props) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => paletteFor(env, scope), [env, scope]);
  const q = query.trim().toLowerCase();
  return (
    <aside className={cn('flex min-h-0 flex-col bg-surface', className)} aria-label="Block palette">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <Segmented<PaletteScope>
          label="Palette section"
          size="sm"
          value={scope}
          onChange={onScope}
          options={[
            { value: 'top', label: 'Top' },
            { value: 'tick', label: 'Tick' },
            { value: 'generation', label: 'Generation' },
          ]}
        />
        <TextInput aria-label="Search blocks" placeholder="Search blocks" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {groups.map((g) => {
          const items = q ? g.items.filter((i) => i.key.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)) : g.items;
          if (items.length === 0) return null;
          return (
            <section key={g.id} className="mb-4">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
                <span className="size-2 rounded-full" style={{ background: CATEGORY_COLORS[g.id] }} />
                {g.label}
              </h4>
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <Item key={item.key} item={item} color={CATEGORY_COLORS[g.id]} onAdd={onAdd} disabled={disabled} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
