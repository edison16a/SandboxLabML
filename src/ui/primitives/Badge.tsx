import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';

type Tone = 'neutral' | 'accent' | 'orange' | 'success' | 'danger' | 'warn';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-muted border-border',
  accent: 'bg-accent-soft text-accent border-accent/30',
  orange: 'bg-orange-soft text-orange border-orange/30',
  success: 'bg-success/10 text-success border-success/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  warn: 'bg-warn/10 text-warn border-warn/30',
};

/** A small status pill. */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[11px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
