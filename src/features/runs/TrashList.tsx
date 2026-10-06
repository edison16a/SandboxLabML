'use client';

import { RotateCcw, Trash2 } from 'lucide-react';
import type { RunRow } from '@/storage/db';
import { TRASH_DAYS } from '@/storage/runs';
import { Button } from '@/ui/primitives/Button';
import { daysLeft } from './format';

/** Trashed runs with restore and delete-forever actions. */
export function TrashList({ rows, onRestore, onDestroy, onEmpty }: { rows: RunRow[]; onRestore: (id: string) => void; onDestroy: (id: string) => void; onEmpty: () => void }) {
  if (!rows.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Trash</h2>
        <Button size="sm" variant="ghost" onClick={onEmpty}>
          <Trash2 />
          Empty trash now
        </Button>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="text-subtle">{r.generation} generations</span>
            <span className="w-32 text-right text-subtle">{daysLeft(r.deletedAt ?? Date.now(), TRASH_DAYS)} days left</span>
            <Button size="sm" variant="outline" onClick={() => onRestore(r.id)}>
              <RotateCcw />
              Restore
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Delete ${r.name} forever`} onClick={() => onDestroy(r.id)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
