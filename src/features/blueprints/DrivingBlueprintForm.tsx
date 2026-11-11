'use client';

import type { DrivingBlueprint } from '@/engine/driving/blueprints';
import { LIDAR_LIMITS } from '@/engine/driving/info';
import { DRIVING_INPUT_GROUPS, type DrivingInputGroup } from '@/engine/driving/sensors/inputConfig';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Slider } from '@/ui/primitives/Slider';
import { BrainStartFields, InputToggle } from './BrainStartFields';

const GROUP_LABELS: Record<DrivingInputGroup, [string, string]> = {
  lane: ['Lane', 'Offset from the lane, heading error, the way ahead and how sharp the road bends.'],
  route: ['Route', 'The next turn, how far to it and how far to the destination.'],
  light: ['Traffic light', 'The light ahead and how far its stop line is.'],
  carAhead: ['Car ahead', 'Gap to the car in front and how fast it closes.'],
  pedestrian: ['People', 'The nearest person in the path or on a crossing it will drive over.'],
  speed: ['Speed', 'Its own speed and the speed limit.'],
};

/** Every editable part of a driving brain blueprint. Changes are reported up as a new object. */
export function DrivingBlueprintForm({ value, onChange }: { value: DrivingBlueprint; onChange: (b: DrivingBlueprint) => void }) {
  const set = (patch: Partial<DrivingBlueprint>) => onChange({ ...value, ...patch });
  const inputs = value.inputs;
  const setInputs = (patch: Partial<DrivingBlueprint['inputs']>) => set({ inputs: { ...inputs, ...patch } });
  const lidar = inputs.lidar;
  const fovDeg = Math.round((lidar.fov * 180) / Math.PI);
  return (
    <div className="flex flex-col gap-5">
      <Field label="Name">
        <TextInput value={value.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} />
      </Field>
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label={`Lidar beams: ${lidar.count}`}>
          <Slider
            label="Lidar beams"
            min={LIDAR_LIMITS.minCount}
            max={LIDAR_LIMITS.maxCount}
            value={lidar.count}
            onChange={(v) => setInputs({ lidar: { ...lidar, count: v, fov: v === 1 ? 0 : lidar.fov || Math.PI } })}
          />
        </Field>
        <Field label={`Field of view: ${fovDeg}°`}>
          <Slider label="Field of view" min={0} max={360} step={5} value={fovDeg} disabled={lidar.count === 1} onChange={(v) => setInputs({ lidar: { ...lidar, fov: (v * Math.PI) / 180 } })} />
        </Field>
        <Field label={`Range: ${lidar.range} m`}>
          <Slider label="Lidar range" min={LIDAR_LIMITS.minRange} max={LIDAR_LIMITS.maxRange} step={5} value={lidar.range} onChange={(v) => setInputs({ lidar: { ...lidar, range: v } })} />
        </Field>
      </section>
      <section className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-muted">Other inputs</span>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <InputToggle label="What each beam hit" hint="A curb or wall, a car or a person. One more input per beam." checked={inputs.lidarKinds} onChange={(v) => setInputs({ lidarKinds: v })} />
          {DRIVING_INPUT_GROUPS.map((k) => (
            <InputToggle key={k} label={GROUP_LABELS[k][0]} hint={GROUP_LABELS[k][1]} checked={inputs[k]} onChange={(v) => setInputs({ [k]: v } as Partial<DrivingBlueprint['inputs']>)} />
          ))}
        </div>
      </section>
      <BrainStartFields value={value} onChange={onChange} />
    </div>
  );
}
