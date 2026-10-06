'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '@/ui/cn';

/** Ids a text input inside a Field picks up, so it is named by the Field's label without wiring by hand. */
const FieldIds = createContext<{ control: string; label: string; hint?: string } | null>(null);

/**
 * A label above a control, with an optional hint underneath.
 *
 * It is a labelled group rather than a <label> element. A <label> names the
 * first control inside it with all of its text, so a row of choice buttons
 * would read as one long button, and a click anywhere in the field would
 * press the first choice.
 */
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  const ids = { control: `${id}control`, label: `${id}label`, hint: hint ? `${id}hint` : undefined };
  return (
    <div role="group" aria-labelledby={ids.label} aria-describedby={ids.hint} className={cn('flex flex-col gap-1.5', className)}>
      <label id={ids.label} htmlFor={ids.control} className="text-[12px] font-medium text-muted">
        {label}
      </label>
      <FieldIds.Provider value={ids}>{children}</FieldIds.Provider>
      {hint && (
        <span id={ids.hint} className="text-[11px] text-subtle">
          {hint}
        </span>
      )}
    </div>
  );
}

/** Plain text input matching the select styling. Inside a Field it takes the Field's label and hint. */
export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const ids = useContext(FieldIds);
  return (
    <input
      id={ids?.control}
      aria-describedby={ids?.hint}
      className={cn(
        'h-8 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] text-fg placeholder:text-subtle hover:border-border-strong focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}
