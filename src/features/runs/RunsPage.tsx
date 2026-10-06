'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Car, FileUp, Trash2, Users } from 'lucide-react';
import { importRun } from '@/storage/exportImport';
import { destroyRun, emptyTrash, restoreRun } from '@/storage/runs';
import type { RunRow } from '@/storage/db';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { toast } from '@/ui/toast/toastStore';
import { RunCard, type RunAction } from './RunCard';
import { RunsDialogs, type OpenDialog } from './RunsDialogs';
import { StorageMeter } from './StorageMeter';
import { TrashList } from './TrashList';
import { useRunActions } from './useRunActions';
import { useRuns } from './useRuns';

type Filter = 'all' | 'racing' | 'hideseek';

/** Every saved run, the storage they take, Trash, import and the destructive actions. */
export function RunsPage() {
  const { runs, trash, reload } = useRuns();
  const actions = useRunActions(reload);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<OpenDialog>(null);
  const file = useRef<HTMLInputElement>(null);
  const shown = runs?.filter((r) => filter === 'all' || r.row.env === filter) ?? [];
  const trashBytes = trash.reduce((s, r) => s + r.generation * 1600, 0);

  const onAction = (run: RunRow, a: RunAction) => {
    if (a === 'export') void actions.exportFile(run);
    else if (a === 'delete') void actions.trash(run);
    else if (a === 'duplicate') void actions.duplicate(run);
    else setOpen({ kind: a, run });
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const config = await importRun(await f.text());
      toast.success('Run imported', config.name);
      await reload();
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
            <p className="mt-1 text-[14px] text-muted">
              Everything you trained, saved in this browser. Open a run to keep training, or branch,
              rewind and export it.
            </p>
          </div>
          <StorageMeter trashBytes={trashBytes} refreshKey={(runs?.length ?? 0) + trash.length} />
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Filter>
            label="Filter runs"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              {
                value: 'racing',
                label: (
                  <>
                    <Car />
                    Racing
                  </>
                ),
              },
              {
                value: 'hideseek',
                label: (
                  <>
                    <Users />
                    Hide and Seek
                  </>
                ),
              },
            ]}
          />
          <div className="ml-auto flex gap-2">
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => void onImport(e.target.files?.[0]).then(() => (e.target.value = ''))}
            />
            <Button variant="outline" onClick={() => file.current?.click()}>
              <FileUp />
              Import run
            </Button>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          {runs === null && <div className="h-24 animate-pulse rounded-lg bg-surface" />}
          {runs !== null && shown.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
              <p className="text-[15px] font-medium">No runs yet</p>
              <p className="max-w-sm text-[13px] text-muted">
                Runs appear here as soon as you start training in a lab.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/lab/racing"
                  prefetch={false}
                  className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-semibold text-[#06101f]"
                >
                  Open the Racing lab
                </Link>
                <Link
                  href="/lab/hide-seek"
                  prefetch={false}
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[13px]"
                >
                  Hide and Seek
                </Link>
              </div>
            </div>
          )}
          {shown.map((s) => (
            <RunCard key={s.row.id} summary={s} onAction={(a) => onAction(s.row, a)} />
          ))}
        </section>

        <TrashList
          rows={trash}
          onRestore={(id) => void restoreRun(id).then(reload)}
          onDestroy={(id) => void destroyRun(id).then(reload)}
          onEmpty={() => void emptyTrash().then(reload)}
        />

        <section className="flex flex-col gap-2 border-t border-border pt-6">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">
            Danger zone
          </h2>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/30 px-4 py-3">
            <p className="text-[13px] text-muted">
              Delete every run, script, blueprint and cache stored by SandboxLab in this browser.
            </p>
            <Button variant="danger" onClick={() => setOpen({ kind: 'deleteAll' })}>
              <Trash2 />
              Delete all data
            </Button>
          </div>
        </section>

        <RunsDialogs open={open} setOpen={setOpen} actions={actions} reload={reload} />
      </div>
    </div>
  );
}
