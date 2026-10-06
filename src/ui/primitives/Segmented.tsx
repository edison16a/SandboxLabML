'use client';

import { ToggleGroup } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
  title?: string;
}

interface SegmentedProps<V extends string> {
  value: V;
  options: ReadonlyArray<SegmentOption<V>>;
  onChange: (value: V) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
  /** Use light text, for controls drawn over the 3D viewport. */
  overlay?: boolean;
  /**
   * Also report a click on the choice that is already on. Settings needs it:
   * the quality shown there can be a default nobody picked, and clicking it
   * is how someone picks it.
   */
  reselect?: boolean;
  'data-tour'?: string;
}

/** A row of mutually exclusive buttons, like the speed bar and view switch. */
export function Segmented<V extends string>({ value, options, onChange, label, size = 'md', className, overlay = false, reselect = false, ...rest }: SegmentedProps<V>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix sends an empty value when the active item is clicked again.
      onValueChange={(v) => {
        if (v) onChange(v as V);
        else if (reselect) onChange(value);
      }}
      aria-label={label}
      data-tour={rest['data-tour']}
      className={cn('inline-flex items-center gap-0.5 rounded-md border border-border bg-surface-2 p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-[5px] font-medium transition-colors data-[state=on]:shadow-sm [&_svg]:size-3.5',
            overlay
              ? 'text-white/70 hover:text-white data-[state=on]:bg-white/20 data-[state=on]:text-white'
              : 'text-muted hover:text-fg data-[state=on]:bg-surface-3 data-[state=on]:text-fg',
            size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-7 px-2.5 text-[12px]',
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
