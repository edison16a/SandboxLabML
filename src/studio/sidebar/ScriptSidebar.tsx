'use client';

import { useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ScriptEntry } from '@/storage/scripts';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { duplicate, newScript, openScript, remove, rename } from '../state/scriptActions';
import { useStudio, type EnvFilter } from '../state/studioStore';
import { RenameDialog } from './RenameDialog';
import { ScriptRow } from './ScriptRow';
import { useScriptLists } from './useScriptLists';

function Group({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-2 text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {empty ? <p className="px-2 py-1 text-[12px] text-subtle">{empty}</p> : <ul className="flex flex-col gap-0.5">{children}</ul>}
    </section>
  );
}

/**
 * The script list: the author's scripts, then the read only presets,
 * filtered by environment. The buttons on top act on the open script.
 */
export function ScriptSidebar({ className }: { className?: string }) {
  const filter = useStudio((s) => s.envFilter);
  const current = useStudio((s) => s.script);
  const { mine, presets, loading } = useScriptLists();
  const [renaming, setRenaming] = useState<ScriptEntry | null>(null);
  const row = (e: ScriptEntry) => (
    <ScriptRow
      key={e.id}
      entry={e}
      active={current?.id === e.id}
      onOpen={() => void openScript(e.id)}
      onDuplicate={() => void duplicate(e.id)}
      onRename={e.readonly ? undefined : () => setRenaming(e)}
      onDelete={e.readonly ? undefined : () => void remove(e.id, e.name)}
    />
  );
  const editable = current !== null && !current.readonly;
  return (
    <aside className={cn('flex min-h-0 flex-col bg-surface', className)} aria-label="Scripts">
      <div className="flex flex-col gap-3 border-b border-border p-3">
        <div className="flex items-center gap-1">
          <Button variant="primary" size="sm" onClick={() => void newScript(filter === 'all' ? 'racing' : filter)}>
            <Plus />
            New
          </Button>
          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip content="Duplicate the open script">
              <Button size="icon-sm" variant="ghost" aria-label="Duplicate" disabled={!current} onClick={() => current && void duplicate(current.id)}>
                <Copy />
              </Button>
            </Tooltip>
            <Tooltip content="Rename the open script">
              <Button size="icon-sm" variant="ghost" aria-label="Rename" disabled={!editable} onClick={() => current && setRenaming(current)}>
                <Pencil />
              </Button>
            </Tooltip>
            <Tooltip content="Delete the open script">
              <Button size="icon-sm" variant="ghost" aria-label="Delete" disabled={!editable} onClick={() => current && void remove(current.id, current.name)}>
                <Trash2 />
              </Button>
            </Tooltip>
          </div>
        </div>
        <Segmented<EnvFilter>
          label="Environment filter"
          size="sm"
          value={filter}
          onChange={(v) => useStudio.setState({ envFilter: v })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'racing', label: 'Racing' },
            { value: 'hideseek', label: 'Hide and Seek' },
          ]}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
        <Group title="My scripts" empty={!loading && mine.length === 0 ? 'No scripts yet. Press New, or duplicate a preset.' : undefined}>
          {mine.map(row)}
        </Group>
        <Group title="Presets" empty={presets.length === 0 ? 'No presets for this environment yet.' : undefined}>
          {presets.map(row)}
        </Group>
      </div>
      {renaming && <RenameDialog name={renaming.name} onClose={() => setRenaming(null)} onRename={(n) => void rename(renaming.id, n)} />}
    </aside>
  );
}
