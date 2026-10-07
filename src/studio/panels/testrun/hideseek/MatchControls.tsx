'use client';

import { Dices } from 'lucide-react';
import { HIDESEEK_LAYOUT_IDS, HIDESEEK_LAYOUTS } from '@/engine/hideseek/layouts/presets';
import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';
import { TEST_MATCH_SEED } from '@/engine/lessons/hideseek/rules';
import { Button } from '@/ui/primitives/Button';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { Select } from '@/ui/primitives/Select';
import type { MatchBrains } from './types';

export interface MatchSettings {
  /** The room picked by hand, or null to follow the script's first room. */
  layout: HideSeekLayoutId | null;
  brains: MatchBrains;
  seed: number;
}

interface Props {
  value: MatchSettings;
  onChange: (next: MatchSettings) => void;
  /** Rooms the script names, in order. They are listed first. */
  named: readonly HideSeekLayoutId[];
  room: HideSeekLayoutId;
  disabled: boolean;
}

const SEED_HINT: Record<MatchBrains, string> = {
  test: `Sets where players and boxes start. Lesson checks use ${TEST_MATCH_SEED}.`,
  random: 'Sets the start and both brains.',
};

/** Room, players and seed for a Hide and Seek test match. */
export function MatchControls({ value, onChange, named, room, disabled }: Props) {
  const set = (patch: Partial<MatchSettings>) => onChange({ ...value, ...patch });
  const order = [...named, ...HIDESEEK_LAYOUT_IDS.filter((id) => !named.includes(id))];
  const options = order.map((id) => ({ value: id, label: HIDESEEK_LAYOUTS[id].name, hint: named.includes(id) ? 'Named in the script' : HIDESEEK_LAYOUTS[id].description }));
  return (
    <div className="flex flex-col gap-3">
      <Field label="Room">
        <Select label="Room" value={room} disabled={disabled} onChange={(layout) => set({ layout })} options={options} />
      </Field>
      <Field label="Players">
        <Segmented<MatchBrains>
          label="Players"
          value={value.brains}
          onChange={(brains) => set({ brains })}
          options={[
            { value: 'test', label: 'Test players', title: 'The fixed players lesson checks use' },
            { value: 'random', label: 'Random brains', title: "Fresh brains built from the script's blueprint" },
          ]}
        />
      </Field>
      <Field label="Seed" hint={SEED_HINT[value.brains]}>
        <div className="flex gap-2">
          <TextInput type="number" aria-label="Seed" value={value.seed} disabled={disabled} onChange={(e) => set({ seed: Number(e.target.value) || 0 })} className="w-32" />
          <Button variant="outline" size="icon" aria-label="New random seed" disabled={disabled} onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}>
            <Dices />
          </Button>
        </div>
      </Field>
    </div>
  );
}
