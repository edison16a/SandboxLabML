'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, FolderOpen } from 'lucide-react';
import { listRuns } from '@/storage/runs';
import type { RunRow } from '@/storage/db';
import { setSetting } from '@/storage/settings';
import { DropdownMenu as M } from 'radix-ui';
import { LAST_RUN_KEY } from '../hooks/useRunBootstrap';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';

/** The open run's name, as a menu that switches to any other racing run. It steps aside when the toolbar is narrow; the Runs page does the same job. */
export function RunSwitcher() {
  const run = useRacingLab((s) => s.run);
  const router = useRouter();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const open = async (id: string) => {
    await racingSession().pause();
    if (await racingSession().openRun(id)) await setSetting(LAST_RUN_KEY, id);
  };
  if (!run) return null;
  return (
    <M.Root onOpenChange={(o) => o && void listRuns().then((r) => setRuns(r.filter((x) => x.env === 'racing').slice(0, 12)))}>
      <M.Trigger asChild>
        <button className="hidden h-8 max-w-60 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted hover:bg-surface-2 hover:text-fg @min-[44rem]:inline-flex">
          <span className="truncate">{run.name}</span>
          <ChevronsUpDown className="size-3.5 shrink-0" />
        </button>
      </M.Trigger>
      <M.Portal>
        <M.Content side="top" align="end" sideOffset={6} className="z-50 w-64 animate-fade-in rounded-md border border-border-strong bg-surface-2 p-1 shadow-xl shadow-black/40">
          <M.Label className="px-2 py-1 text-[11px] text-subtle">Racing runs</M.Label>
          {runs.map((r) => (
            <M.Item key={r.id} onSelect={() => void open(r.id)} className="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-surface-3">
              <Check className={r.id === run.id ? 'size-3.5 text-accent' : 'size-3.5 opacity-0'} />
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="font-mono text-[11px] text-subtle">{r.generation}</span>
            </M.Item>
          ))}
          <M.Separator className="my-1 h-px bg-border" />
          <M.Item onSelect={() => router.push('/runs')} className="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-surface-3">
            <FolderOpen className="size-3.5" />
            All runs
          </M.Item>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
