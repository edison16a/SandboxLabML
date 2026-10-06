import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';

interface PanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** A titled card used inside side panels and pages. */
export function Panel({ title, actions, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn('rounded-lg border border-border bg-surface', className)}>
      {(title || actions) && (
        <header className="flex h-9 items-center justify-between gap-2 border-b border-border px-3">
          <h3 className="text-[12px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={cn('p-3', bodyClassName)}>{children}</div>
    </section>
  );
}

/** A label and value pair, used in stat rows and the model card. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5" title={hint}>
      <span className="text-[11px] text-muted">{label}</span>
      <span className="tabular font-mono text-[15px] font-medium text-fg">{value}</span>
    </div>
  );
}
