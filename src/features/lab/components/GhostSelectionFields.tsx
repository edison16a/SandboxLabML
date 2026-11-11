'use client';

import { Field, TextInput } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import type { GhostSelection } from '../session/ghostSelection';

type Mode = GhostSelection['mode'];

/**
 * Which past champions ride along as ghosts: auto, every Nth, a range or
 * a hand picked list, and which ones show now. A lab's ghost menu puts its
 * own toggles under it.
 */
export function GhostSelectionFields({ value, shown, onChange }: { value: GhostSelection; shown: number[]; onChange: (next: GhostSelection) => void }) {
  const changeMode = (mode: Mode) => {
    if (mode === 'auto') onChange({ mode });
    else if (mode === 'every') onChange({ mode, n: 5 });
    else if (mode === 'range') onChange({ mode, from: 0, to: 20 });
    else onChange({ mode, generations: shown });
  };
  return (
    <>
      <Field label="Which generations">
        <Segmented<Mode>
          label="Ghost selection"
          size="sm"
          value={value.mode}
          onChange={changeMode}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'every', label: 'Every Nth' },
            { value: 'range', label: 'Range' },
            { value: 'pick', label: 'Pick' },
          ]}
        />
      </Field>
      {value.mode === 'every' && (
        <Field label="Every">
          <TextInput type="number" min={1} value={value.n} onChange={(e) => onChange({ mode: 'every', n: Math.max(1, Number(e.target.value) || 1) })} />
        </Field>
      )}
      {value.mode === 'range' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="From gen">
            <TextInput type="number" min={1} value={value.from + 1} onChange={(e) => onChange({ ...value, from: Math.max(0, Number(e.target.value) - 1) })} />
          </Field>
          <Field label="To gen">
            <TextInput type="number" min={1} value={value.to + 1} onChange={(e) => onChange({ ...value, to: Math.max(0, Number(e.target.value) - 1) })} />
          </Field>
        </div>
      )}
      {value.mode === 'pick' && (
        <Field label="Generations" hint="Like 1, 5, 20">
          <TextInput
            defaultValue={value.generations.map((g) => g + 1).join(', ')}
            onBlur={(e) => onChange({ mode: 'pick', generations: e.target.value.split(',').map((x) => Number(x.trim()) - 1).filter((x) => x >= 0) })}
          />
        </Field>
      )}
      <p className="text-[12px] text-muted">Showing {shown.length ? shown.map((g) => g + 1).join(', ') : 'none yet'}</p>
    </>
  );
}
