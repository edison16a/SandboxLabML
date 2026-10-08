'use client';

import type { RacingBlueprint } from '@/engine/blueprints/types';
import { RACING_SCALARS, type RacingScalar } from '@/engine/racing/sensors/inputConfig';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Slider } from '@/ui/primitives/Slider';
import { BrainStartFields, InputToggle } from './BrainStartFields';

const SCALAR_LABELS: Record<RacingScalar, [string, string?]> = {
  speed: ['Speed'],
  headingError: ['Heading error', 'Angle between the car and the road.'],
  steerAngle: ['Steering angle', 'Where the front wheels point.'],
  curvatureNear: ['Curve at 15 m', 'How sharply the road bends just ahead.'],
  curvatureFar: ['Curve at 40 m', 'The bend further on, for braking early.'],
  slip: ['Lateral slip', 'How much the car slides sideways.'],
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
            <InputToggle key={k} label={SCALAR_LABELS[k][0]} hint={SCALAR_LABELS[k][1]} checked={inputs[k]} onChange={(v) => setInputs({ [k]: v } as Partial<RacingBlueprint['inputs']>)} />
          ))}
        </div>
      </section>
      <BrainStartFields value={value} onChange={onChange} />
    </div>
  );
}
