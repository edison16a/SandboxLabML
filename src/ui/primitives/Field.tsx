import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';

/** A label above a control, with an optional hint underneath. */
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[12px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-subtle">{hint}</span>}
    </label>
  );
}

/** Plain text input matching the select styling. */
export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-8 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] text-fg placeholder:text-subtle hover:border-border-strong focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}
