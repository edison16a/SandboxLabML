'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';

interface Props {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  /** Names what is counted for screen readers, such as "Gen 12". */
  label: string;
  /** Shows a remove button at the last copy instead of stopping at `min`. */
  removable?: boolean;
}

const step = 'size-6 text-white/70 hover:bg-white/15 hover:text-white [&_svg]:size-3.5';

/** Minus, count, plus. A removable row turns its minus into a remove button at one copy, like a basket. */
export function CopiesStepper({ value, min = 1, max, onChange, label, removable = false }: Props) {
  const removing = removable && value <= 1;
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.04] p-0.5">
      <Button size="icon-sm" variant="ghost" className={step} onClick={() => onChange(value - 1)} disabled={!removing && value <= min} aria-label={removing ? `Remove ${label}` : `One fewer ${label}`}>
        {removing ? <Trash2 /> : <Minus />}
      </Button>
      {/* A live output, so a screen reader hears "3 copies of Gen 12" after each press. */}
      <output className="tabular w-5 text-center font-mono text-[12px] text-white" aria-live="polite">
        {value}
        <span className="sr-only">
          {value === 1 ? ' copy' : ' copies'} of {label}
        </span>
      </output>
      <Button size="icon-sm" variant="ghost" className={step} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`One more ${label}`}>
        <Plus />
      </Button>
    </div>
  );
}
