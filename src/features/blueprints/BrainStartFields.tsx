'use client';

import type { Blueprint } from '@/engine/blueprints/types';
import { DEFAULT_HIDDEN_COUNT, MAX_HIDDEN_LAYERS } from '@/engine/neat/startShape';
import { ACTIVATIONS, type Activation } from '@/engine/neat/types';
import { Field } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { Select } from '@/ui/primitives/Select';
import { Slider } from '@/ui/primitives/Slider';
import { Switch } from '@/ui/primitives/Switch';

/** One input group that can be switched on or off, with a line on what it tells the brain when the name does not say it. */
export function InputToggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-13 items-center justify-between gap-3 border-b border-border py-2">
      <span className="flex flex-col">
        <span className="text-[13px]">{label}</span>
        {hint && <span className="text-[11px] text-subtle">{hint}</span>}
      </span>
      <Switch label={label} checked={checked} onChange={onChange} />
    </label>
  );
}

/**
 * The fields every blueprint has, whatever the game: sensor noise and how
 * the brain starts out (activation, wiring and the hidden layers). Both
 * blueprint forms end with these, so the two editors read the same.
 */
export function BrainStartFields<B extends Blueprint>({ value, onChange }: { value: B; onChange: (b: B) => void }) {
  const set = (patch: Partial<Blueprint>) => onChange({ ...value, ...patch } as B);
  return (
    <>
      {/* The wiring choice takes the room its three labels need, so "Hidden layers" never wraps. */}
      <section className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <Field label={`Sensor noise: ${Math.round(value.inputs.noise * 100)}%`} hint="Random error on every reading. Brains get sturdier but learn slower.">
          <Slider
            label="Sensor noise"
            min={0}
            max={10}
            value={Math.round(value.inputs.noise * 100)}
            onChange={(v) => set({ inputs: { ...value.inputs, noise: v / 100 } } as Partial<Blueprint>)}
          />
        </Field>
        <Field label="Activation" hint="How a hidden neuron turns its input into an output.">
          <Select<Activation>
            label="Activation"
            value={value.activation}
            onChange={(v) => set({ activation: v })}
            options={ACTIVATIONS.map((a) => ({ value: a, label: a === 'relu' ? 'ReLU' : a[0].toUpperCase() + a.slice(1) }))}
          />
        </Field>
        <Field label="Starting wiring" hint="Training adds neurons and layers as it goes.">
          <Segmented
            label="Starting wiring"
            size="sm"
            className="self-start"
            value={value.wiring}
            onChange={(w) =>
              set({ wiring: w, hiddenCount: w === 'hidden' ? (value.hiddenCount ?? DEFAULT_HIDDEN_COUNT) : undefined, hiddenLayers: w === 'hidden' ? (value.hiddenLayers ?? 1) : undefined })
            }
            options={[
              { value: 'direct', label: 'Direct', title: 'Every input linked to every output' },
              { value: 'sparse', label: 'Sparse', title: 'About half of those links' },
              { value: 'hidden', label: 'Hidden layers', title: 'Layers of hidden neurons in between' },
            ]}
          />
        </Field>
      </section>
      {value.wiring === 'hidden' && (
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label={`Hidden layers: ${value.hiddenLayers ?? 1}`} hint="More layers can learn harder moves, but start slower.">
            <Slider label="Hidden layers" min={1} max={MAX_HIDDEN_LAYERS} value={value.hiddenLayers ?? 1} onChange={(v) => set({ hiddenLayers: v })} />
          </Field>
          <Field label={`Neurons per layer: ${value.hiddenCount ?? DEFAULT_HIDDEN_COUNT}`}>
            <Slider label="Neurons per layer" min={1} max={16} value={value.hiddenCount ?? DEFAULT_HIDDEN_COUNT} onChange={(v) => set({ hiddenCount: v })} />
          </Field>
        </section>
      )}
    </>
  );
}
