'use client';

import type { Blueprint } from '@/engine/blueprints/types';
import { ACTIVATIONS, type Activation } from '@/engine/neat/types';
import { Field } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { Select } from '@/ui/primitives/Select';
import { Slider } from '@/ui/primitives/Slider';
import { Switch } from '@/ui/primitives/Switch';

/** One input group that can be switched on or off, with a line on what it tells the brain. */
export function InputToggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-border py-2">
      <span className="flex flex-col">
        <span className="text-[13px]">{label}</span>
        <span className="text-[11px] text-subtle">{hint}</span>
      </span>
      <Switch label={label} checked={checked} onChange={onChange} />
    </label>
  );
}

/**
 * The fields every blueprint has, whatever the game: sensor noise and how
 * the brain starts out (activation, wiring and the hidden layer). Both
 * blueprint forms end with these, so the two editors read the same.
 */
export function BrainStartFields<B extends Blueprint>({ value, onChange }: { value: B; onChange: (b: B) => void }) {
  const set = (patch: Partial<Blueprint>) => onChange({ ...value, ...patch } as B);
  return (
    <>
      {/* The wiring choice takes the room its three labels need, so "Hidden layer" never wraps. */}
      <section className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <Field label={`Sensor noise: ${Math.round(value.inputs.noise * 100)}%`} hint="Off by default. Noise makes brains more robust and slower to train.">
          <Slider
            label="Sensor noise"
            min={0}
            max={10}
            value={Math.round(value.inputs.noise * 100)}
            onChange={(v) => set({ inputs: { ...value.inputs, noise: v / 100 } } as Partial<Blueprint>)}
          />
        </Field>
        <Field label="Activation" hint="Used by hidden neurons. Outputs always use tanh.">
          <Select<Activation>
            label="Activation"
            value={value.activation}
            onChange={(v) => set({ activation: v })}
            options={ACTIVATIONS.map((a) => ({ value: a, label: a === 'relu' ? 'ReLU' : a[0].toUpperCase() + a.slice(1) }))}
          />
        </Field>
        <Field label="Starting wiring">
          <Segmented
            label="Starting wiring"
            size="sm"
            className="self-start"
            value={value.wiring}
            onChange={(w) => set({ wiring: w, hiddenCount: w === 'hidden' ? (value.hiddenCount ?? 4) : undefined })}
            options={[
              { value: 'direct', label: 'Direct' },
              { value: 'sparse', label: 'Sparse' },
              { value: 'hidden', label: 'Hidden layer' },
            ]}
          />
        </Field>
      </section>
      {value.wiring === 'hidden' && (
        <Field label={`Hidden neurons: ${value.hiddenCount ?? 4}`}>
          <Slider label="Hidden neurons" min={1} max={16} value={value.hiddenCount ?? 4} onChange={(v) => set({ hiddenCount: v })} />
        </Field>
      )}
    </>
  );
}
