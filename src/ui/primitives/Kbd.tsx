import type { ReactNode } from 'react';

/** A keyboard key label, used in tooltips and the shortcuts dialog. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border-strong bg-surface-2 px-1 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}
