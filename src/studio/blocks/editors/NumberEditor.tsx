'use client';

import { useState } from 'react';
import type { UnitName } from '@/engine/script';
import { Button } from '@/ui/primitives/Button';
import { TextInput } from '@/ui/primitives/Field';
import { UNIT_CHOICES } from '../model/valueBlocks';

interface Props {
  value: number;
  unit: UnitName;
  onApply: (value: number, unit: UnitName) => void;
}

/**
 * A number and its unit. Changes apply on Enter or the button rather than
 * on every keystroke, because each apply reprints the script and replaces
 * this very pill.
 */
export function NumberEditor({ value, unit, onApply }: Props) {
  const [text, setText] = useState(String(value));
  const [u, setU] = useState<UnitName>(unit);
  const parsed = Number(text);
  const valid = text.trim() !== '' && Number.isFinite(parsed);
  const apply = () => valid && onApply(parsed, u);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div className="flex gap-2">
        <TextInput autoFocus aria-label="Number" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} className="w-24 font-mono" />
        <select
          aria-label="Unit"
          value={u}
          onChange={(e) => setU(e.target.value as UnitName)}
          className="h-8 rounded-md border border-border bg-surface-2 px-2 text-[13px] text-fg hover:border-border-strong focus:border-accent focus:outline-none"
        >
          {UNIT_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="primary" size="md" disabled={!valid}>
          Set
        </Button>
      </div>
      {!valid && <span className="text-[11px] text-danger">Type a number, such as 3 or 0.5.</span>}
    </form>
  );
}
