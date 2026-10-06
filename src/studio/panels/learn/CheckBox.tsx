'use client';

import { CircleCheck, CircleX, ListChecks, Square } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import type { CheckState } from './player';

interface Props {
  check: CheckState;
  onCheck: () => void;
  onCancel: () => void;
  onNext: (() => void) | null;
}

/** The Check button, its progress while a check plays or trains, and the verdict. */
export function CheckBox({ check, onCheck, onCancel, onNext }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {check.status === 'running' ? (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Checking" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(check.progress * 100)}>
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.max(4, check.progress * 100)}%` }} />
          </div>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <Square />
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="primary" className="self-start" onClick={onCheck}>
          <ListChecks />
          Check
        </Button>
      )}
      {check.status === 'done' && (
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[13px] ${check.outcome.passed ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10'}`} role="status">
          {check.outcome.passed ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-danger" />}
          <span className="flex-1">
            {check.outcome.message}
            {check.outcome.measured !== undefined && <span className="ml-1 font-mono text-[12px] text-muted">(measured {check.outcome.measured.toFixed(2)})</span>}
          </span>
          {check.outcome.passed && onNext && (
            <Button size="sm" variant="primary" onClick={onNext}>
              Next step
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
