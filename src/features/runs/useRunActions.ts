'use client';

import { useRouter } from 'next/navigation';
import { downloadJson, exportRun } from '@/storage/exportImport';
import { branchRun, duplicateRun, resetRun, rewindRun } from '@/storage/runActions';
import { destroyRun, renameRun, restoreRun, trashRun } from '@/storage/runs';
import type { RunRow } from '@/storage/db';
import { toast } from '@/ui/toast/toastStore';

function labPath(env: RunRow['env'], id: string): string {
  return `${env === 'racing' ? '/lab/racing' : '/lab/hide-seek'}?run=${id}`;
}

/**
 * Every run action wrapped with a toast, and an Undo where the action moved
 * something to Trash. `reload` refreshes the list afterwards.
 */
export function useRunActions(reload: () => Promise<void>) {
  const router = useRouter();
  const done = async (title: string, undo?: () => Promise<void>) => {
    await reload();
    if (undo) toast.withAction(title, { label: 'Undo', onClick: () => void undo().then(reload) });
    else toast.success(title);
  };
  const guard = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
    } catch (err) {
      toast.error('That did not work', err instanceof Error ? err.message : String(err));
    }
  };
  return {
    rename: (run: RunRow, name: string) => guard(async () => { await renameRun(run.id, name); await done('Renamed'); })(),
    exportFile: (run: RunRow) =>
      guard(async () => {
        const data = await exportRun(run.id);
        const slug = run.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'run';
        downloadJson(`${slug}.sandboxlab.json`, data);
      })(),
    branch: (run: RunRow, gen: number) =>
      guard(async () => {
        const c = await branchRun(run.id, gen);
        await done(`Branched from generation ${gen + 1}`);
        router.push(labPath(c.env, c.id));
      })(),
    rewind: (run: RunRow, gen: number) =>
      guard(async () => {
        const c = await rewindRun(run.id, gen);
        await done(`Rewound to generation ${gen + 1}`, async () => {
          await restoreRun(run.id);
          await trashRun(c.id);
        });
      })(),
    reset: (run: RunRow) =>
      guard(async () => {
        const c = await resetRun(run.id);
        await done('Started over. The old run is in Trash.', async () => {
          await restoreRun(run.id);
          await destroyRun(c.id);
        });
      })(),
    duplicate: (run: RunRow) => guard(async () => { await duplicateRun(run.id, Math.floor(Math.random() * 1e9)); await done('Duplicated'); })(),
    trash: (run: RunRow) => guard(async () => { await trashRun(run.id); await done(`Moved "${run.name}" to Trash`, () => restoreRun(run.id)); })(),
  };
}
