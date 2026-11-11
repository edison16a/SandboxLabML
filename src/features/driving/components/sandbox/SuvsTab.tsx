'use client';

import { useMemo, useState } from 'react';
import { Award, Plus } from 'lucide-react';
import { sandboxCapacity } from '@/engine/driving/sandbox';
import { ghostCss } from '@/features/charts/ghostCss';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Slider } from '@/ui/primitives/Slider';
import { Switch } from '@/ui/primitives/Switch';
import { copiesOf, fieldSize, setCopies, type FieldEntry } from '../../sandbox/field';
import { drivingSession } from '../../session/DrivingSession';
import { useDrivingLab } from '../../state/labStore';
import { CopiesStepper } from './CopiesStepper';
import { overlayButton, sectionLabel } from './overlay';

const TIER = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

/** Dot color for each row: the ghost color of the row's front SUV, which the stream puts first among its copies. */
function rowColors(field: readonly FieldEntry[]): Map<number, string> {
  const total = fieldSize(field);
  const out = new Map<number, string>();
  let start = 0;
  for (const e of [...field].sort((a, b) => a.generation - b.generation)) {
    out.set(e.generation, ghostCss(total > 1 ? start / (total - 1) : 1));
    start += e.copies;
  }
  return out;
}

/** The shipped trained model: a switch to drive it instead of the run's champions, and how many copies line up. */
function TrainedModelCard({ cap }: { cap: number }) {
  const trained = useDrivingLab((s) => s.trained);
  const on = useDrivingLab((s) => s.sandbox?.model ?? false);
  const copies = useDrivingLab((s) => s.sandbox?.modelCopies ?? 1);
  const controls = () => drivingSession().sandbox;
  return (
    <div className={cn('flex flex-col gap-2 rounded-md border p-2.5', on ? 'border-accent/50 bg-accent/10' : 'border-white/10 bg-white/[0.04]')}>
      <label className="flex items-start gap-2.5">
        <Award className="mt-0.5 size-4 shrink-0 text-orange" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-medium text-white">Try a trained model</span>
          <span className="text-[11px] leading-snug text-white/60">
            {trained ? `The ${TIER[trained.model.tier]} preset's champion, benchmark ${Math.round(trained.model.score)}. It drives without any training here.` : 'Loading the shipped model.'}
          </span>
        </span>
        <Switch label="Drive the trained model" checked={on} disabled={!trained} onChange={(v) => controls()?.update({ model: v })} />
      </label>
      {on && (
        <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[12px] text-white/70">
          <span>Copies in line</span>
          <CopiesStepper label="trained model" value={Math.min(copies, cap)} max={cap} canRemove={false} keepOne onChange={(n) => controls()?.update({ modelCopies: Math.max(1, n) })} />
        </div>
      )}
    </div>
  );
}

/**
 * The SUVs at the start: the trained model, or the run's champions with
 * how many copies of each. The newest champion starts in front and copies
 * queue behind it, so several of one brain show how it handles a line.
 */
export function SuvsTab() {
  const field = useDrivingLab((s) => s.sandbox?.field ?? []);
  const trip = useDrivingLab((s) => s.sandbox?.trip);
  const model = useDrivingLab((s) => s.sandbox?.model ?? false);
  const records = useDrivingLab((s) => s.records);
  const [chosen, setChosen] = useState<number | null>(null);
  const colors = useMemo(() => rowColors(field), [field]);
  const cap = useMemo(() => (trip ? sandboxCapacity(trip) : 1), [trip]);
  const total = fieldSize(field);
  const change = (generation: number, copies: number) => drivingSession().sandbox?.update({ field: setCopies(field, generation, copies, cap) });

  return (
    <div className="flex flex-col gap-3">
      <TrainedModelCard cap={cap} />
      <div className={cn('flex flex-col gap-2', model && 'pointer-events-none opacity-45')} aria-disabled={model}>
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>Your champions</span>
          <span className="tabular font-mono text-[11px] text-white/55">
            {Math.min(total, cap)} of {cap} SUVs
          </span>
        </div>
        {records.length === 0 ? (
          <p className="text-[12px] leading-snug text-white/55">Train a few generations to line up your own champions here.</p>
        ) : (
          <ChampionRows field={field} colors={colors} total={total} cap={cap} change={change} chosen={chosen} setChosen={setChosen} />
        )}
      </div>
    </div>
  );
}

interface RowsProps {
  field: FieldEntry[];
  colors: Map<number, string>;
  total: number;
  cap: number;
  change: (generation: number, copies: number) => void;
  chosen: number | null;
  setChosen: (g: number) => void;
}

function ChampionRows({ field, colors, total, cap, change, chosen, setChosen }: RowsProps) {
  const records = useDrivingLab((s) => s.records);
  const first = records[0].generation;
  const newest = records[records.length - 1].generation;
  const adding = Math.min(Math.max(chosen ?? newest, first), newest);
  return (
    <>
      <ul className="flex flex-col gap-1">
        {field.map((e) => (
          <li key={e.generation} className="flex h-8 items-center gap-2 rounded-md bg-white/[0.04] pr-0.5 pl-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: colors.get(e.generation) }} />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white">Gen {e.generation + 1}</span>
            <CopiesStepper label={`Gen ${e.generation + 1}`} value={e.copies} max={e.copies + Math.max(0, cap - total)} canRemove={total > 1} onChange={(n) => change(e.generation, n)} />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
        <div className="flex items-center justify-between text-[12px] text-white/70">
          <span>Add a champion</span>
          <span className="tabular font-mono text-white">Gen {adding + 1}</span>
        </div>
        <div className="flex items-center gap-3">
          <Slider label="Generation to add" min={first} max={newest} value={adding} onChange={setChosen} disabled={first === newest} />
          <Button size="sm" variant="secondary" className={overlayButton} disabled={total >= cap} onClick={() => change(adding, copiesOf(field, adding) + 1)}>
            <Plus />
            Add
          </Button>
        </div>
      </div>
    </>
  );
}
