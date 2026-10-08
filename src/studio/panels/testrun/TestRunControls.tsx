'use client';

import { Dices } from 'lucide-react';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { Button } from '@/ui/primitives/Button';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { Select } from '@/ui/primitives/Select';
import type { ChampionSource } from '../useRacingChampions';

export interface TestSettings {
  trackId: string;
  brain: 'random' | 'champion';
  seed: number;
  /** Run id whose latest champion drives. */
  runId: string | null;
}

interface Props {
  value: TestSettings;
  onChange: (next: TestSettings) => void;
  sources: ChampionSource[];
  disabled: boolean;
}

/** Track and brain for a test run. A champion comes from any racing run stored in this browser. */
export function TestRunControls({ value, onChange, sources, disabled }: Props) {
  const set = (patch: Partial<TestSettings>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <Field label="Track">
        <Select label="Track" value={value.trackId} disabled={disabled} onChange={(trackId) => set({ trackId })} options={BUILT_IN_TRACKS.map((t) => ({ value: t.id, label: t.name }))} />
      </Field>
      <Field label="Brain">
        <Segmented<TestSettings['brain']>
          label="Brain"
          value={value.brain}
          onChange={(brain) => set({ brain })}
          options={[
            { value: 'random', label: 'Random brain' },
            { value: 'champion', label: 'Latest champion' },
          ]}
        />
      </Field>
      {value.brain === 'random' ? (
        <Field label="Seed" hint="Same seed, same brain.">
          <div className="flex gap-2">
            <TextInput type="number" aria-label="Seed" value={value.seed} disabled={disabled} onChange={(e) => set({ seed: Number(e.target.value) || 0 })} className="w-32" />
            <Button variant="outline" size="icon" aria-label="New random seed" disabled={disabled} onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}>
              <Dices />
            </Button>
          </div>
        </Field>
      ) : sources.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-[12px] text-muted">No trained racing runs yet.</p>
      ) : (
        <Field label="Run">
          <Select
            label="Run"
            value={value.runId ?? sources[0].run.id}
            disabled={disabled}
            onChange={(runId) => set({ runId })}
            options={sources.map((s) => ({ value: s.run.id, label: s.run.name, hint: `Champion of generation ${s.latest + 1}, ${s.run.config.blueprint.id}` }))}
          />
        </Field>
      )}
    </div>
  );
}
