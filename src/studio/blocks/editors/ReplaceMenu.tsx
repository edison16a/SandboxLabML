'use client';

import { Binary, Calculator, Hash, Quote, Radar, SquareFunction, ToggleLeft, X } from 'lucide-react';
import type { ScriptBlock } from '@/engine/script';
import { binaryBlock, boolBlock, numberBlock, textBlock, unaryBlock } from '../model/valueBlocks';

export type ReplaceMode = 'name' | 'function';

interface Props {
  /** The value in the slot now. Wrapping options keep it as their first part. */
  current: ScriptBlock | null;
  onReplace: (block: ScriptBlock | null) => void;
  onMode: (mode: ReplaceMode) => void;
  /** Offer "Remove" for slots that may be left out, such as a reward's when. */
  removable: boolean;
}

function Option({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-left text-[12px] text-fg hover:border-border-strong hover:bg-surface-3 [&_svg]:size-3.5 [&_svg]:text-muted"
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * "Change to" choices for a slot. Building blocks such as compare and math
 * wrap the current value instead of throwing it away, so `car.speed`
 * becomes `car.speed > _` in one click.
 */
export function ReplaceMenu({ current, onReplace, onMode, removable }: Props) {
  const keep = current && !(current.type === 'name' && current.fields.name === '_') ? structuredClone(current) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">Change to</span>
      <div className="grid grid-cols-2 gap-1.5">
        <Option icon={<Radar />} label="Sensor or name" onClick={() => onMode('name')} />
        <Option icon={<Hash />} label="Number" onClick={() => onReplace(numberBlock(0))} />
        <Option icon={<Binary />} label="Compare" onClick={() => onReplace(binaryBlock('>', keep, null))} />
        <Option icon={<Calculator />} label="Math" onClick={() => onReplace(binaryBlock('*', keep, null))} />
        <Option icon={<Binary />} label="And" onClick={() => onReplace(binaryBlock('and', keep, null))} />
        <Option icon={<Binary />} label="Or" onClick={() => onReplace(binaryBlock('or', keep, null))} />
        <Option icon={<ToggleLeft />} label="Not" onClick={() => onReplace(unaryBlock('not', keep))} />
        <Option icon={<SquareFunction />} label="Function" onClick={() => onMode('function')} />
        <Option icon={<ToggleLeft />} label="True" onClick={() => onReplace(boolBlock(true))} />
        <Option icon={<Quote />} label="Text" onClick={() => onReplace(textBlock('crash'))} />
        {current && <Option icon={<X />} label={removable ? 'Remove' : 'Empty'} onClick={() => onReplace(null)} />}
      </div>
    </div>
  );
}
