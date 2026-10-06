'use client';

import Link from 'next/link';
import { Blocks, Code2, Flag, Redo2, Save, Undo2, WandSparkles, AlignLeft } from 'lucide-react';
import { canRedo, canUndo } from '../doc/history';
import { fixAllDocument, formatDocument } from '../state/docActions';
import { saveCurrent } from '../state/scriptActions';
import { isDirty, useStudio, type EditorMode } from '../state/studioStore';
import { Badge } from '@/ui/primitives/Badge';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { Tooltip } from '@/ui/primitives/Tooltip';

const ENV = { racing: 'Racing', hideseek: 'Hide and Seek' } as const;

function SaveState() {
  const dirty = useStudio(isDirty);
  const saving = useStudio((s) => s.saving);
  const readonly = useStudio((s) => s.script?.readonly ?? false);
  if (readonly) return <Badge>Read only</Badge>;
  if (saving) return <span className="text-[12px] text-muted">Saving</span>;
  return dirty ? <span className="text-[12px] text-warn">Unsaved changes</span> : <span className="text-[12px] text-subtle">Saved</span>;
}

/** Above the editor: what is open and the commands that act on it. */
export function EditorToolbar() {
  const script = useStudio((s) => s.script);
  const mode = useStudio((s) => s.mode);
  const history = useStudio((s) => s.history);
  const dirty = useStudio(isDirty);
  const readonly = script?.readonly ?? true;
  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-bg px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-[14px] font-semibold" title={script?.name}>
          {script?.name ?? 'Loading'}
        </h1>
        {script && <Badge tone="accent">{ENV[script.env]}</Badge>}
        <SaveState />
      </div>
      <Segmented<EditorMode>
        label="Editor view"
        value={mode}
        onChange={(m) => useStudio.setState({ mode: m })}
        options={[
          { value: 'code', label: <><Code2 />Code</> },
          { value: 'blocks', label: <><Blocks />Blocks</> },
        ]}
      />
      <div className="ml-auto flex items-center gap-1">
        <Tooltip content="Undo" shortcut="Ctrl Z">
          <Button size="icon-sm" variant="ghost" aria-label="Undo" disabled={!canUndo(history)} onClick={() => useStudio.getState().undo()}>
            <Undo2 />
          </Button>
        </Tooltip>
        <Tooltip content="Redo" shortcut="Ctrl Y">
          <Button size="icon-sm" variant="ghost" aria-label="Redo" disabled={!canRedo(history)} onClick={() => useStudio.getState().redo()}>
            <Redo2 />
          </Button>
        </Tooltip>
        <Tooltip content="Format the script" shortcut="Shift Alt F">
          <Button size="sm" variant="ghost" disabled={readonly} onClick={formatDocument}>
            <AlignLeft />
            <span className="hidden sm:inline">Format</span>
          </Button>
        </Tooltip>
        <Tooltip content="Apply every fix with one clear choice">
          <Button size="sm" variant="ghost" disabled={readonly} onClick={fixAllDocument}>
            <WandSparkles />
            <span className="hidden sm:inline">Fix all</span>
          </Button>
        </Tooltip>
        {script?.env === 'racing' && (
          <Tooltip content={dirty ? 'Save first, then train with this script' : 'Start a racing run that trains with this script'}>
            <Link
              href={`/lab/racing?trainScript=${encodeURIComponent(script.id)}`}
              prefetch={false}
              aria-disabled={dirty}
              onClick={(e) => dirty && e.preventDefault()}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-medium hover:border-border-strong hover:bg-surface-2 aria-disabled:opacity-40 [&_svg]:size-4"
            >
              <Flag />
              <span className="hidden sm:inline">Train</span>
            </Link>
          </Tooltip>
        )}
        <Tooltip content="Save" shortcut="Ctrl S">
          <Button size="sm" variant={dirty ? 'primary' : 'outline'} disabled={readonly || !dirty} onClick={() => void saveCurrent()}>
            <Save />
            Save
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
