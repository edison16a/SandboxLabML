'use client';

import type { NavigationBlueprint } from '@/engine/navigation/pipeline/blueprints';
import { navigationInputCount, type NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Slider } from '@/ui/primitives/Slider';
import { BrainStartFields, InputToggle } from './BrainStartFields';

type Flag = 'goal' | 'pathHint' | 'velocity' | 'time';

const FLAGS: ReadonlyArray<[Flag, string, string]> = [
  ['goal', 'Finish', 'Which way the line is and how far to walk.'],
  ['pathHint', 'Path hint', 'Which way the shortest path round obstacles turns. Makes early levels easy.'],
  ['velocity', 'Velocity', 'How fast it moves forward and sideways.'],
  ['time', 'Time left', 'Share of the run still to go.'],
];

/** Every editable part of a Navigation brain blueprint. Changes are reported up as a new object. */
export function NavigationBlueprintForm({ value, onChange }: { value: NavigationBlueprint; onChange: (b: NavigationBlueprint) => void }) {
  const set = (patch: Partial<NavigationBlueprint>) => onChange({ ...value, ...patch });
  const inputs = value.inputs;
  const setInputs = (patch: Partial<NavigationInputConfig>) => set({ inputs: { ...inputs, ...patch } });
  const rays = inputs.rays;
  const fov = Math.round((rays.fov * 180) / Math.PI);
  return (
    <div className="flex flex-col gap-5">
      <Field label="Name">
        <TextInput value={value.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} />
      </Field>
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label={`Rays: ${rays.count}`}>
          <Slider label="Ray count" min={4} max={24} value={rays.count} onChange={(v) => setInputs({ rays: { ...rays, count: v } })} />
        </Field>
        <Field label={`Field of view: ${fov}°`}>
          <Slider label="Field of view" min={60} max={360} step={10} value={fov} onChange={(v) => setInputs({ rays: { ...rays, fov: (v * Math.PI) / 180 } })} />
        </Field>
        <Field label={`Range: ${rays.range} m`}>
          <Slider label="Ray range" min={2} max={20} value={rays.range} onChange={(v) => setInputs({ rays: { ...rays, range: v } })} />
        </Field>
      </section>
      <section className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-muted">Other inputs, {navigationInputCount(inputs)} in all</span>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <InputToggle label="Hit types" hint="Whether each ray met spikes or a mover. Three inputs per ray." checked={rays.hitTypes} onChange={(v) => setInputs({ rays: { ...rays, hitTypes: v } })} />
          {FLAGS.map(([k, label, hint]) => (
            <InputToggle key={k} label={label} hint={hint} checked={inputs[k]} onChange={(v) => setInputs({ [k]: v })} />
          ))}
        </div>
      </section>
      <BrainStartFields value={value} onChange={onChange} />
    </div>
  );
}
