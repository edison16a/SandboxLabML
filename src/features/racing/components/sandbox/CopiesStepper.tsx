'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';

interface Props {
  value: number;
  max: number;
  onChange: (value: number) => void;
  /** Names the champion for screen readers, e.g. "Gen 12". */
  label: string;
  /** False for the last car on the grid, which cannot be removed. */
  canRemove: boolean;
}

/** Minus, count, plus. At one copy the minus becomes a remove button, like a basket. */
export function CopiesStepper({ value, max, onChange, label, canRemove }: Props) {
  const removing = value <= 1;
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.04] p-0.5">
      <Button
        size="icon-sm"
        variant="ghost"
        className="size-6 text-white/70 hover:bg-white/15 hover:text-white [&_svg]:size-3.5"
        onClick={() => onChange(value - 1)}
        disabled={removing && !canRemove}
        aria-label={removing ? `Remove ${label}` : `One fewer ${label}`}
      >
        {removing ? <Trash2 /> : <Minus />}
      </Button>
      {/* A live output, so a screen reader hears "3 copies of Gen 12" after each press. */}
      <output className="tabular w-5 text-center font-mono text-[12px] text-white" aria-live="polite">
        {value}
        <span className="sr-only">
          {value === 1 ? ' copy' : ' copies'} of {label}
        </span>
      </output>
      <Button
        size="icon-sm"
        variant="ghost"
        className="size-6 text-white/70 hover:bg-white/15 hover:text-white [&_svg]:size-3.5"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`One more ${label}`}
      >
        <Plus />
      </Button>
    </div>
  );
}
