'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ScriptBlock } from '@/engine/script';
import { cn } from '@/ui/cn';
import { BlockHead } from './BlockHead';
import { BlockNote } from './BlockNote';
import { BlockToolbar } from './BlockToolbar';
import { useBlocks } from './BlocksContext';
import { blockTitle, categoryOf, CATEGORY_COLORS } from './model/categories';
import { endDrag, startDrag } from './model/drag';
import { explainBlock } from './model/explain';
import { updateBlock } from './model/ops';
import type { PaletteScope } from './model/palette';
import { pathKey, type BlockPath } from './model/paths';
import { allEntries, StatementList } from './StatementList';
import { focusNeighbor, useBlockActions } from './useBlockActions';

interface Props {
  block: ScriptBlock;
  path: BlockPath;
  scope: PaletteScope;
}

function Nested({ children }: { children: React.ReactNode }) {
  return <div className="my-1 mr-2 ml-4 border-l border-border-strong pl-3">{children}</div>;
}

/**
 * One statement: a note above it, a colored rail for its category, its
 * head line, an optional plain English line, and nested lists for blocks
 * with a body. Focus a block to select it, then Delete removes it,
 * Alt with arrow keys moves it, and Ctrl or Cmd with D duplicates it.
 */
export function StatementBlock({ block, path, scope }: Props) {
  const { env, readOnly, explain, selected, select, apply } = useBlocks();
  const actions = useBlockActions(path);
  const [addingNote, setAddingNote] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const key = pathKey(path);
  const isSelected = selected === key;
  const color = CATEGORY_COLORS[categoryOf(block, env)];

  useEffect(() => {
    // After an edit rebuilds this block, keep keyboard focus on it instead of dropping it to the page.
    if (isSelected && document.activeElement === document.body) box.current?.focus();
  }, [isSelected]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (!readOnly) actions.move(e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusNeighbor(e.currentTarget as HTMLElement, e.key === 'ArrowUp' ? -1 : 1);
    } else if (!readOnly && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      actions.remove();
    } else if (!readOnly && mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      actions.duplicate();
    }
  };

  const hasBody = block.type === 'if' || block.type === 'repeat' || block.type === 'forEach';
  const showNote = block.comment !== null || addingNote;
  const sentence = explain ? explainBlock(block, env) : '';

  return (
    <div>
      {showNote && (
        <BlockNote
          text={block.comment ?? ''}
          readOnly={readOnly}
          startEditing={addingNote}
          onCommit={(text) => {
            setAddingNote(false);
            actions.setNote(text);
          }}
        />
      )}
      <div
        ref={box}
        tabIndex={0}
        role="group"
        data-block={key}
        aria-label={blockTitle(block)}
        onFocus={(e) => e.target === e.currentTarget && select(path)}
        onKeyDown={onKeyDown}
        className={cn('group rounded-md border bg-surface-2 outline-none', isSelected ? 'border-accent/60' : 'border-border', 'focus-visible:ring-2 focus-visible:ring-accent/50')}
        style={{ borderLeftWidth: 3, borderLeftColor: color }}
      >
        <div className="flex items-start gap-1 py-1.5 pr-1.5 pl-2.5">
          <div className="flex min-h-6 min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <BlockHead block={block} path={path} scope={scope} />
          </div>
          {!readOnly && (
            <BlockToolbar
              onDragStart={(e) => {
                if (box.current) e.dataTransfer.setDragImage(box.current, 12, 12);
                startDrag(e, { kind: 'move', path, block }, blockTitle(block));
              }}
              onDragEnd={endDrag}
              onNote={block.comment === null ? () => setAddingNote(true) : null}
              onDuplicate={actions.duplicate}
              onDelete={actions.remove}
            />
          )}
        </div>
        {sentence && <p className="-mt-1 px-2.5 pb-1.5 text-[12px] text-muted">{sentence}.</p>}
        {hasBody && (
          <Nested>
            <StatementList addr={{ parent: path, list: block.type === 'if' ? 'then' : 'body' }} entries={allEntries(block.children[block.type === 'if' ? 'then' : 'body'])} scope={scope} />
          </Nested>
        )}
        {block.type === 'if' && block.children.else && (
          <>
            <div className="px-2.5 text-[13px] font-semibold text-fg">else</div>
            <Nested>
              <StatementList addr={{ parent: path, list: 'else' }} entries={allEntries(block.children.else)} scope={scope} />
            </Nested>
          </>
        )}
        {block.type === 'if' && !block.children.else && !readOnly && (
          <button
            type="button"
            onClick={() => apply((ws) => updateBlock(ws, path, (b) => ({ ...b, children: { ...b.children, else: [] } })))}
            className="mb-1.5 ml-2.5 inline-flex items-center gap-1 rounded px-1 text-[12px] text-subtle hover:text-fg"
          >
            <Plus className="size-3" />
            else
          </button>
        )}
      </div>
    </div>
  );
}
