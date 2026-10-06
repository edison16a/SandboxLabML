'use client';

import { Minus, Plus } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Team dot color class, e.g. bg-hider. */
  dot: string;
}

const step =
  'flex size-6 items-center justify-center rounded text-white/70 transition-colors hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5';

/**
 * A count with minus and plus buttons, for how many players a team gets.
 * Arrow keys step it too when it has focus, like a native spin button.
 */
export function CountStepper({ label, value, min, max, onChange, dot }: Props) {
  // A key at the limit changes nothing, and must not rebuild a running match.
  const set = (v: number) => {
    const next = Math.max(min, Math.min(max, v));
    if (next !== value) onChange(next);
  };
  return (
    <div
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(value + 1);
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(value - 1);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
      className="flex h-8 items-center justify-between rounded-md border border-white/10 bg-white/[0.04] pr-1 pl-2 text-[12px] focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className="flex items-center gap-1.5 text-white/75">
        <span className={`size-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="flex items-center gap-0.5">
        <button type="button" tabIndex={-1} className={step} onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus />
        </button>
        <span className="tabular w-5 text-center font-mono text-[13px] text-white">{value}</span>
        <button type="button" tabIndex={-1} className={step} onClick={() => set(value + 1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
          <Plus />
        </button>
      </span>
    </div>
  );
}
