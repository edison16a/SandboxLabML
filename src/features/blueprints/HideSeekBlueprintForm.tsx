'use client';

import type { HideSeekBlueprint } from '@/engine/blueprints/types';
import type { HideSeekInputConfig } from '@/engine/hideseek/inputConfig';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { Slider } from '@/ui/primitives/Slider';
import { Switch } from '@/ui/primitives/Switch';
import { BrainStartFields, InputToggle } from './BrainStartFields';

type Inputs = HideSeekInputConfig;
/** The input groups that are a plain on or off switch. */
type Flag = 'holding' | 'phase' | 'time' | 'opponentVisible' | 'opponentLastSeen' | 'ramp';

const FLAGS: ReadonlyArray<[Flag, string, string]> = [
  ['holding', 'Holding a box', 'Whether it carries a box right now.'],
  ['phase', 'Prep phase', 'Whether the seekers are still frozen.'],
  ['time', 'Time left', 'How much of the match remains.'],
  ['opponentVisible', 'Opponent in sight', 'Whether it sees the other player.'],
  ['opponentLastSeen', 'Last sighting', 'Which way the other player was last seen.'],
  ['ramp', 'Nearest ramp', 'Where it is, which way is uphill and who locked it.'],
];

/** How the agent senses its own motion: nothing, its forward speed, or its speed forward and sideways. */
type Motion = 'none' | 'speed' | 'velocity';

const motionOf = (i: Inputs): Motion => (i.velocity ? 'velocity' : i.speed ? 'speed' : 'none');

/**
 * Every editable part of a Hide and Seek brain blueprint: the rays, which
 * input groups are on, how many nearby crates it tracks, and how the brain
 * starts out. Changes are reported up as a new object.
 */
export function HideSeekBlueprintForm({ value, onChange }: { value: HideSeekBlueprint; onChange: (b: HideSeekBlueprint) => void }) {
  const inputs = value.inputs;
  const setInputs = (patch: Partial<Inputs>) => onChange({ ...value, inputs: { ...inputs, ...patch } });
  const rays = inputs.rays;
  return (
    <div className="flex flex-col gap-5">
      <Field label="Name">
        <TextInput value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} maxLength={40} />
      </Field>
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label={`Rays: ${rays.count}`} hint="Spread evenly all the way round.">
          <Slider label="Ray count" min={1} max={32} value={rays.count} onChange={(v) => setInputs({ rays: { ...rays, count: v } })} />
        </Field>
        <Field label={`Range: ${rays.range} m`}>
          <Slider label="Ray range" min={4} max={20} value={rays.range} onChange={(v) => setInputs({ rays: { ...rays, range: v } })} />
        </Field>
        <Field label="Hit types" hint="Tells walls, boxes and players apart. Triples the rays.">
          <Switch label="Ray hit types" checked={rays.hitTypes} onChange={(v) => setInputs({ rays: { ...rays, hitTypes: v } })} />
        </Field>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Own motion" hint={inputs.velocity ? 'Speed forward and sideways, 2 inputs.' : inputs.speed ? 'Forward speed, 1 input.' : 'It does not feel itself move.'}>
          <Segmented<Motion>
            label="Own motion"
            size="sm"
            value={motionOf(inputs)}
            onChange={(m) => setInputs({ speed: m === 'speed', velocity: m === 'velocity' })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'speed', label: 'Speed' },
              { value: 'velocity', label: 'Velocity' },
            ]}
          />
        </Field>
        <Field label="Nearest crates" hint="Where the closest cubes and planks are and whether they are locked, 4 inputs each.">
          <Segmented
            label="Nearest crates"
            size="sm"
            value={String(inputs.nearestBoxes)}
            onChange={(v) => setInputs({ nearestBoxes: Number(v) })}
            options={['0', '1', '2', '3', '4'].map((v) => ({ value: v, label: v }))}
          />
        </Field>
      </section>
      <section className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-muted">Other inputs</span>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {FLAGS.map(([k, label, hint]) => (
            <InputToggle key={k} label={label} hint={hint} checked={inputs[k]} onChange={(v) => setInputs({ [k]: v })} />
          ))}
        </div>
      </section>
      <BrainStartFields value={value} onChange={onChange} />
    </div>
  );
}
