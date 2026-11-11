'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ReferenceTier } from '@/engine/bench/types';
import { cn } from '@/ui/cn';
import { Loading } from '@/ui/feedback/Spinner';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { Slider } from '@/ui/primitives/Slider';
import { navigationSession } from '../../session/NavigationSession';
import { useNavigationLab } from '../../state/labStore';
import { fieldSize, MAX_RUNNERS, setCopies } from '../../state/sandboxState';
import { CopiesStepper } from './CopiesStepper';
import { glassButton, pickable, sectionLabel } from './glass';

const TIER_LABEL: Record<ReferenceTier, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

/** The run's champions on the grid: which generations run and how many copies of each. The newest takes the front row. */
function FieldEditor() {
  const field = useNavigationLab((s) => s.sandbox.field);
  const records = useNavigationLab((s) => s.records);
  const [chosen, setChosen] = useState<number | null>(null);
  const control = () => navigationSession().sandbox;
  if (!records.length) return <p className="rounded-md border border-dashed border-white/15 p-3 text-[12px] text-white/60">Train a generation first, or try a trained model.</p>;
  const total = fieldSize(field);
  const first = records[0].generation;
  const newest = records[records.length - 1].generation;
  const adding = Math.min(Math.max(chosen ?? newest, first), newest);
  const change = (generation: number, copies: number) => control()?.configure({ field: setCopies(field, generation, copies) });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={sectionLabel}>On the grid</span>
        <span className="tabular font-mono text-[11px] text-white/55">
          {total} of {MAX_RUNNERS}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {field.map((e) => (
          <li key={e.generation} className="flex h-8 items-center gap-2 rounded-md bg-white/[0.04] pr-0.5 pl-2">
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white">Champion of gen {e.generation + 1}</span>
            <CopiesStepper label={`Gen ${e.generation + 1}`} value={e.copies} max={e.copies + MAX_RUNNERS - total} removable onChange={(n) => change(e.generation, n)} />
          </li>
        ))}
      </ul>
      <div className="mt-1 flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
        <div className="flex items-center justify-between text-[12px] text-white/70">
          <span>Add a champion</span>
          <span className="tabular font-mono text-white">Gen {adding + 1}</span>
        </div>
        <div className="flex items-center gap-3">
          <Slider label="Generation to add" min={first} max={newest} value={adding} onChange={setChosen} disabled={first === newest} />
          <Button size="sm" variant="secondary" className={glassButton} disabled={total >= MAX_RUNNERS} onClick={() => change(adding, (field.find((e) => e.generation === adding)?.copies ?? 0) + 1)}>
            <Plus />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The models shipped with the app, one per script preset, and how many copies run. */
function ModelPicker() {
  const models = useNavigationLab((s) => s.sandbox.models);
  const tier = useNavigationLab((s) => s.sandbox.model);
  const copies = useNavigationLab((s) => s.sandbox.modelCopies);
  const control = () => navigationSession().sandbox;
  if (models === null) return <Loading label="Loading the trained models" className="justify-start text-[12px] text-white/60" />;
  if (!models.length) return <p className="text-[12px] text-white/60">No trained models came with this version.</p>;
  return (
    <div className="flex flex-col gap-2">
      <span className={sectionLabel}>Trained with a preset</span>
      <div role="radiogroup" aria-label="Trained model" className="flex flex-col gap-1">
        {models.map((m) => (
          <button key={m.tier} type="button" role="radio" aria-checked={m.tier === tier} onClick={() => m.tier !== tier && control()?.configure({ model: m.tier })} className={cn('flex h-9 items-center gap-2 rounded-md border px-2.5 text-left text-[12px] transition-colors', pickable(m.tier === tier))}>
            <span className="flex-1 font-medium">{TIER_LABEL[m.tier]}</span>
            <span className="text-[11px] text-white/55">
              score <span className="tabular font-mono text-white/85">{Math.round(m.score)}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1 text-[12px] text-white/70">
        <span>Copies</span>
        <CopiesStepper label={`${TIER_LABEL[tier]} model`} value={copies} max={MAX_RUNNERS} onChange={(n) => control()?.configure({ modelCopies: n })} />
      </div>
      <p className="text-[11px] leading-snug text-white/50">Champions of the reference runs, scored on courses they never trained on.</p>
    </div>
  );
}

/** Who runs: champions of this run, or a model that came trained with the app. */
export function RunnersTab() {
  const source = useNavigationLab((s) => s.sandbox.source);
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="Runners"
        size="sm"
        overlay
        value={source}
        onChange={(v) => navigationSession().sandbox?.configure({ source: v })}
        options={[
          { value: 'run', label: 'This run' },
          { value: 'model', label: 'Trained model' },
        ]}
        data-tour="sandbox-models"
      />
      {source === 'run' ? <FieldEditor /> : <ModelPicker />}
    </div>
  );
}
