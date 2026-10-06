'use client';

import type { RacingBlueprint } from '@/engine/blueprints/types';
import { ACTIVATIONS, type Activation } from '@/engine/neat/types';
import { RACING_SCALARS, type RacingScalar } from '@/engine/racing/sensors/inputConfig';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { Select } from '@/ui/primitives/Select';
import { Slider } from '@/ui/primitives/Slider';
import { Switch } from '@/ui/primitives/Switch';

const SCALAR_LABELS: Record<RacingScalar, [string, string]> = {
  speed: ['Speed', 'How fast the car is going.'],
  headingError: ['Heading error', 'Angle between the car and the road direction.'],
  steerAngle: ['Steering angle', 'Where the front wheels point right now.'],
  curvatureNear: ['Curve at 15 m', 'How sharply the road bends just ahead.'],
  curvatureFar: ['Curve at 40 m', 'How sharply it bends further ahead, for braking early.'],
  slip: ['Lateral slip', 'How much grip the tires are missing.'],
};

/** Every editable part of a racing brain blueprint. Changes are reported up as a new object. */
export function RacingBlueprintForm({ value, onChange }: { value: RacingBlueprint; onChange: (b: RacingBlueprint) => void }) {
  const set = (patch: Partial<RacingBlueprint>) => onChange({ ...value, ...patch });
  const inputs = value.inputs;
  const setInputs = (patch: Partial<RacingBlueprint['inputs']>) => set({ inputs: { ...inputs, ...patch } });
  const rays = inputs.rays;
  return (
    <div className="flex flex-col gap-5">
      <Field label="Name">
        <TextInput value={value.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} />
      </Field>
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label={`Rays: ${rays.count}`}>
          <Slider label="Ray count" min={1} max={33} value={rays.count} onChange={(v) => setInputs({ rays: { ...rays, count: v, fov: v === 1 ? 0 : rays.fov || Math.PI } })} />
        </Field>
        <Field label={`Field of view: ${Math.round((rays.fov * 180) / Math.PI)}°`}>
          <Slider label="Field of view" min={0} max={360} step={5} value={Math.round((rays.fov * 180) / Math.PI)} disabled={rays.count === 1} onChange={(v) => setInputs({ rays: { ...rays, fov: (v * Math.PI) / 180 } })} />
        </Field>
        <Field label={`Range: ${rays.range} m`}>
          <Slider label="Ray range" min={20} max={120} step={5} value={rays.range} onChange={(v) => setInputs({ rays: { ...rays, range: v } })} />
        </Field>
      </section>
      <section className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-muted">Other inputs</span>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {RACING_SCALARS.map((k) => (
            <label key={k} className="flex items-center justify-between gap-3 border-b border-border py-2">
              <span className="flex flex-col">
                <span className="text-[13px]">{SCALAR_LABELS[k][0]}</span>
                <span className="text-[11px] text-subtle">{SCALAR_LABELS[k][1]}</span>
              </span>
              <Switch label={SCALAR_LABELS[k][0]} checked={inputs[k]} onChange={(v) => setInputs({ [k]: v } as Partial<RacingBlueprint['inputs']>)} />
            </label>
          ))}
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label={`Sensor noise: ${Math.round(inputs.noise * 100)}%`} hint="Off by default. Noise makes brains more robust and slower to train.">
          <Slider label="Sensor noise" min={0} max={10} value={Math.round(inputs.noise * 100)} onChange={(v) => setInputs({ noise: v / 100 })} />
        </Field>
        <Field label="Activation" hint="Used by hidden neurons. Outputs always use tanh.">
          <Select<Activation> label="Activation" value={value.activation} onChange={(v) => set({ activation: v })} options={ACTIVATIONS.map((a) => ({ value: a, label: a === 'relu' ? 'ReLU' : a[0].toUpperCase() + a.slice(1) }))} />
        </Field>
        <Field label="Starting wiring">
          <Segmented
            label="Starting wiring"
            size="sm"
            value={value.wiring}
            onChange={(w) => set({ wiring: w, hiddenCount: w === 'hidden' ? value.hiddenCount ?? 4 : undefined })}
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
    </div>
  );
}
