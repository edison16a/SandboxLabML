'use client';

import { useMemo, useState } from 'react';
import type { EnvId } from '@/engine/env/types';
import { entriesFor } from '@/engine/script';
import { TextInput } from '@/ui/primitives/Field';
import type { PaletteScope } from '../model/palette';

interface Props {
  env: EnvId | null;
  scope: PaletteScope;
  /** Names the script declares itself, such as lets and sensors. */
  locals: string[];
  onPick: (name: string) => void;
}

interface Choice {
  name: string;
  label: string;
  detail: string;
  group: string;
}

/** A searchable list of everything a slot can read: registry sensors and constants for the section, plus the script's own names. */
export function NamePicker({ env, scope, locals, onPick }: Props) {
  const [query, setQuery] = useState('');
  const choices = useMemo<Choice[]>(() => {
    // Sensors first: they are what a slot usually reads. Constants such as pi go last.
    const registry = entriesFor(env, scope === 'generation' ? 'generation' : 'tick')
      .filter((e) => e.kind === 'sensor' || e.kind === 'constant')
      .sort((a, b) => Number(a.kind === 'constant') - Number(b.kind === 'constant'))
      .map((e) => ({ name: e.name, label: e.block.label, detail: e.type === 'bool' ? 'true or false' : e.unit === '' ? 'number' : e.unit, group: e.block.category }));
    const own = locals.map((n) => ({ name: n, label: n, detail: 'yours', group: 'your names' }));
    return [...own, ...registry];
  }, [env, scope, locals]);
  const q = query.trim().toLowerCase();
  const shown = q ? choices.filter((c) => c.name.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)) : choices;
  return (
    <div className="flex flex-col gap-2">
      <TextInput
        autoFocus
        aria-label="Search sensors"
        placeholder="Search sensors"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && shown[0]) {
            e.preventDefault();
            onPick(shown[0].name);
          }
        }}
      />
      <ul className="-mx-1 max-h-56 overflow-y-auto" role="listbox" aria-label="Sensors">
        {shown.map((c) => (
          <li key={c.name}>
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onPick(c.name)}
              className="flex w-full items-baseline justify-between gap-3 rounded px-2 py-1 text-left hover:bg-surface-3 focus-visible:bg-surface-3"
            >
              <span className="min-w-0 truncate text-[12px]">
                <span className="text-fg">{c.label}</span> <span className="font-mono text-[11px] text-subtle">{c.name !== c.label ? c.name : ''}</span>
              </span>
              <span className="shrink-0 text-[11px] text-muted">{c.detail}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-2 text-[12px] text-subtle">Nothing matches.</li>}
      </ul>
    </div>
  );
}
