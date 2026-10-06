'use client';

import { Slider as S } from 'radix-ui';
import { cn } from '@/ui/cn';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  className?: string;
  label: string;
  disabled?: boolean;
}

/** Single-thumb slider. `label` is required because the thumb has no visible text. */
export function Slider({ value, min, max, step = 1, onChange, onCommit, className, label, disabled }: SliderProps) {
  return (
    <S.Root
      className={cn('relative flex h-5 w-full touch-none items-center select-none', className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(v) => onChange(v[0])}
      onValueCommit={(v) => onCommit?.(v[0])}
    >
      <S.Track className="relative h-1 grow overflow-hidden rounded-full bg-surface-3">
        <S.Range className="absolute h-full bg-accent" />
      </S.Track>
      <S.Thumb
        aria-label={label}
        className="block size-3.5 rounded-full border-2 border-accent bg-bg shadow transition-transform hover:scale-110 focus-visible:outline-2"
      />
    </S.Root>
  );
}
