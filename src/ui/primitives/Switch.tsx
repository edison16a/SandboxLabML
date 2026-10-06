'use client';

import { Switch as S } from 'radix-ui';
import { cn } from '@/ui/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}

/** A compact toggle. The label is for screen readers; place visible text next to it. */
export function Switch({ checked, onChange, label, className, disabled }: SwitchProps) {
  return (
    <S.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-border-strong bg-surface-3 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-40',
        className,
      )}
    >
      <S.Thumb className="block size-3 translate-x-[2px] rounded-full bg-fg transition-transform data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-[#06101f]" />
    </S.Root>
  );
}
