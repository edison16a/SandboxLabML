'use client';

import Link from 'next/link';
import { Car, Copy, Download, GitBranch, MoreHorizontal, Pencil, RotateCcw, Trash2, Undo2, Users } from 'lucide-react';
import { formatBytes } from '@/engine/neat/metrics';
import { TrackThumb } from '@/features/racing/components/TrackThumb';
import { Badge } from '@/ui/primitives/Badge';
import { Button } from '@/ui/primitives/Button';
import { Menu } from '@/ui/primitives/Menu';
import { timeAgo } from './format';
import type { RunSummary } from './useRuns';

export type RunAction = 'rename' | 'export' | 'branch' | 'rewind' | 'reset' | 'delete' | 'duplicate';

function labHref(summary: RunSummary): string {
  const base = summary.row.env === 'racing' ? '/lab/racing' : '/lab/hide-seek';
  return `${base}?run=${summary.row.id}`;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[11px] text-subtle">{label}</span>
      <span className="tabular truncate font-mono text-[13px] text-fg">{value}</span>
    </div>
  );
}

/** One run on the Runs page: what it is, how far it got, how big its brain is, and its actions. */
export function RunCard({ summary, onAction }: { summary: RunSummary; onAction: (a: RunAction) => void }) {
  const { row, model } = summary;
  const racing = row.env === 'racing';
  const track = row.config.racing?.track;
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong sm:flex-row sm:items-center">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-surface-2 text-accent">
        {racing && track ? <TrackThumb spec={track} size={56} /> : racing ? <Car className="size-6" /> : <Users className="size-6 text-seeker" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[15px] font-semibold">{row.name}</h3>
          <Badge tone={racing ? 'accent' : 'orange'}>{racing ? 'Racing' : 'Hide and Seek'}</Badge>
          <Badge>{row.config.blueprint.name}</Badge>
          {row.config.scripts.length > 0 && <Badge tone="success">Script</Badge>}
          {row.config.parent && (
            <Badge>
              <GitBranch className="size-3" />
              branch
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-2 sm:grid-cols-6">
          <Metric label="Generations" value={row.generation} />
          <Metric label="Best fitness" value={row.bestFitness.toFixed(1)} />
          <Metric label={racing ? 'Best lap' : 'Best distance'} value={racing ? (row.bestLapTime > 0 ? `${row.bestLapTime.toFixed(2)} s` : '-') : '-'} />
          <Metric label="Benchmark" value={row.benchmark !== undefined ? row.benchmark.toFixed(0) : '-'} />
          <Metric label="Parameters" value={model ? model.parameters : '-'} />
          <Metric label="Brain size" value={model ? formatBytes(model.bytes) : '-'} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        <span className="text-[12px] text-subtle">{timeAgo(row.updatedAt)}</span>
        <div className="flex items-center gap-1.5">
          <Link href={labHref(summary)} prefetch={false} className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-semibold text-[#06101f] hover:bg-[#62a8ff]">
            Open
          </Link>
          <Menu
            trigger={
              <Button size="icon" variant="outline" aria-label={`Actions for ${row.name}`}>
                <MoreHorizontal />
              </Button>
            }
            items={[
              { label: 'Rename', icon: <Pencil />, onSelect: () => onAction('rename') },
              { label: 'Export file', icon: <Download />, onSelect: () => onAction('export') },
              { label: 'Branch from generation', icon: <GitBranch />, onSelect: () => onAction('branch'), disabled: !racing || row.generation === 0 },
              { label: 'Rewind to checkpoint', icon: <Undo2 />, onSelect: () => onAction('rewind'), disabled: !racing },
              { label: 'Start over with same setup', icon: <RotateCcw />, onSelect: () => onAction('reset'), separatorBefore: true },
              { label: 'Duplicate settings', icon: <Copy />, onSelect: () => onAction('duplicate') },
              { label: 'Move to Trash', icon: <Trash2 />, onSelect: () => onAction('delete'), danger: true, separatorBefore: true },
            ]}
          />
        </div>
      </div>
    </article>
  );
}
