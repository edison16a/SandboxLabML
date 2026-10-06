'use client';

import type { EnvId } from '@/engine/env/types';
import { entriesFor, type RegistryEntry } from '@/engine/script';
import type { PaletteScope } from '../model/palette';

interface Props {
  env: EnvId | null;
  scope: PaletteScope;
  onPick: (entry: RegistryEntry) => void;
}

/** Functions that return a value, such as abs or the ray reading, for the "Function" choice of a slot. */
export function FunctionPicker({ env, scope, onPick }: Props) {
  const fns = entriesFor(env, scope === 'generation' ? 'generation' : 'tick').filter((e) => e.kind === 'function');
  return (
    <ul className="-mx-1 max-h-60 overflow-y-auto" aria-label="Functions">
      {fns.map((e) => (
        <li key={e.name}>
          <button type="button" onClick={() => onPick(e)} className="flex w-full flex-col rounded px-2 py-1 text-left hover:bg-surface-3 focus-visible:bg-surface-3">
            <span className="font-mono text-[12px] text-fg">{e.name}</span>
            <span className="text-[11px] text-muted">{e.summary}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
