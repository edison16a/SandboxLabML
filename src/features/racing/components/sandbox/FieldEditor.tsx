'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ghostCss } from '@/features/charts/ghostCss';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Slider } from '@/ui/primitives/Slider';
import { copiesOf, fieldSize, MAX_FIELD, setCopies, type FieldEntry } from '../../session/field';
import { racingSession } from '../../session/RacingSession';
import { drivenDistance, frontCopies } from '../../session/telemetry';
import { trackFor } from '../../session/trackChoice';
import { useRacingLab } from '../../state/labStore';
import { CopiesStepper } from './CopiesStepper';
import { overlayButton, sectionLabel } from './overlay';

interface Result {
  text: string;
  crashed: boolean;
}

/**
 * How each champion did on the Sandbox track, from the headless telemetry
 * pass, as its front copy drove it. Distances count from the car's own
 * grid slot.
 */
function useResults(): Map<number, Result> {
  const telemetry = useRacingLab((s) => s.telemetry);
  const spec = useRacingLab((s) => s.sandboxTrack);
  return useMemo(() => {
    const length = spec ? trackFor(spec).length : 0;
    const out = new Map<number, Result>();
    for (const [generation, t] of frontCopies(telemetry)) {
      const driven = Math.round(drivenDistance(t));
      const laps = length > 0 ? Math.floor((t.distance[t.distance.length - 1] ?? 0) / length) : 0;
      const text = t.crash ? `Crash at ${driven} m` : laps >= 1 ? `${laps} ${laps === 1 ? 'lap' : 'laps'}` : `${driven} m`;
      out.set(generation, { text, crashed: !!t.crash });
    }
    return out;
  }, [telemetry, spec]);
}

/** Dot color for each row: the ghost color of the row's front car, which the stream puts first among its copies. */
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

/**
 * The cars on the grid: which champions race and how many copies of each.
 * The newest champion takes pole and copies line up behind it, so six of
 * the same brain show how a different start plays out.
 */
export function FieldEditor() {
  const field = useRacingLab((s) => s.sandboxField);
  const records = useRacingLab((s) => s.records);
  const [chosen, setChosen] = useState<number | null>(null);
  const results = useResults();
  const colors = useMemo(() => rowColors(field), [field]);
  if (!records.length) return null;

  const total = fieldSize(field);
  const first = records[0].generation;
  const newest = records[records.length - 1].generation;
  const adding = Math.min(Math.max(chosen ?? newest, first), newest);
  const change = (generation: number, copies: number) => racingSession().sandbox?.setField(setCopies(field, generation, copies));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={sectionLabel}>On the grid</span>
        <span className="tabular font-mono text-[11px] text-white/55">
          {total} of {MAX_FIELD} cars
        </span>
      </div>
      <div className="flex items-center gap-2 px-2 text-[10px] font-medium tracking-wide text-white/40 uppercase">
        <span className="flex-1">Champion</span>
        <span className="w-[92px] text-right">On this track</span>
        <span className="w-[82px] text-center">Copies</span>
      </div>
      <ul className="flex flex-col gap-1">
        {field.map((e) => {
          const result = results.get(e.generation);
          return (
            <li key={e.generation} className="flex h-8 items-center gap-2 rounded-md bg-white/[0.04] pr-0.5 pl-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: colors.get(e.generation) }} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white">
                Gen {e.generation + 1}
              </span>
              <span className={cn('w-[92px] truncate text-right text-[11px]', result?.crashed ? 'text-danger' : 'text-white/60')}>{result?.text ?? 'Timing'}</span>
              <CopiesStepper label={`Gen ${e.generation + 1}`} value={e.copies} max={e.copies + MAX_FIELD - total} canRemove={total > 1} onChange={(n) => change(e.generation, n)} />
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
        <div className="flex items-center justify-between text-[12px] text-white/70">
          <span>Add a champion</span>
          <span className="tabular font-mono text-white">Gen {adding + 1}</span>
        </div>
        <div className="flex items-center gap-3">
          <Slider label="Generation to add" min={first} max={newest} value={adding} onChange={setChosen} disabled={first === newest} />
          <Button size="sm" variant="secondary" className={overlayButton} disabled={total >= MAX_FIELD} onClick={() => change(adding, copiesOf(field, adding) + 1)}>
            <Plus />
            Add
          </Button>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-white/50">The newest champion on the grid starts on pole. Picking generations in the Ghosts menu also sets the grid.</p>
    </div>
  );
}
