'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';

interface Props {
  value: number;
  max: number;
  onChange: (value: number) => void;
  /** Names the champion for screen readers, such as "Gen 12". */
  label: string;
  /** False for the last SUV in line, which cannot be removed. */
  canRemove: boolean;
  /** Counts that never reach zero (the trained model's copies) keep a plain minus, greyed out at one. */
  keepOne?: boolean;
}

/** Minus, count, plus. At one copy the minus becomes a remove button, like a basket. */
export function CopiesStepper({ value, max, onChange, label, canRemove, keepOne = false }: Props) {
  const removing = value <= 1 && !keepOne;
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.04] p-0.5">
      <Button
        size="icon-sm"
        variant="ghost"
        className="size-6 text-white/70 hover:bg-white/15 hover:text-white [&_svg]:size-3.5"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1 && (keepOne || !canRemove)}
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
