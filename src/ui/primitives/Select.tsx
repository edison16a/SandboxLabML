'use client';

import { Select as S } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/ui/cn';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  hint?: string;
}

interface SelectProps<V extends string> {
  value: V;
  options: ReadonlyArray<SelectOption<V>>;
  onChange: (value: V) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}

/** Dropdown select with optional per-option hints. */
export function Select<V extends string>({ value, options, onChange, label, className, disabled }: SelectProps<V>) {
  return (
    <S.Root value={value} onValueChange={(v) => onChange(v as V)} disabled={disabled}>
      <S.Trigger
        aria-label={label}
        className={cn(
          'inline-flex h-8 min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] text-fg hover:border-border-strong disabled:opacity-40',
          className,
        )}
      >
        <span className="truncate">
          <S.Value />
        </span>
        <S.Icon>
          <ChevronDown className="size-3.5 text-muted" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] animate-fade-in overflow-hidden rounded-md border border-border-strong bg-surface-2 shadow-xl shadow-black/40"
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-default flex-col rounded px-2 py-1.5 pr-7 text-[13px] outline-none select-none data-[highlighted]:bg-surface-3"
              >
                <S.ItemText>{o.label}</S.ItemText>
                {o.hint && <span className="text-[11px] text-muted">{o.hint}</span>}
                <S.ItemIndicator className="absolute top-2 right-2">
                  <Check className="size-3.5 text-accent" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
