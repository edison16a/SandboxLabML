import { LoaderCircle } from 'lucide-react';
import { cn } from '../cn';

/** A turning ring for anything that takes more than a moment. Hidden from screen readers; pair it with words. */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn('size-4 animate-spin text-accent', className)} />;
}

/** A spinner with a short line beside it, for a pane that is still loading. */
export function Loading({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 text-[13px] text-muted', className)}>
      <Spinner />
      {label}
    </div>
  );
}
