'use client';

import { Play, Square } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';

interface Props {
  running: boolean;
  /** Errors in the script block a run. */
  blocked: boolean;
  label: string;
  /** What the status line says while the test runs, and before it. */
  busy: string;
  idle: string;
  onRun: () => void;
  onCancel: () => void;
}

/** The run button, which turns into Cancel while a test runs, and a one line status. */
export function RunBar({ running, blocked, label, busy, idle, onRun, onCancel }: Props) {
  return (
    <div className="flex items-center gap-2">
      {running ? (
        <Button variant="outline" onClick={onCancel}>
          <Square />
          Cancel
        </Button>
      ) : (
        <Button variant="primary" onClick={onRun} disabled={blocked}>
          <Play />
          {label}
        </Button>
      )}
      <span className="text-[12px] text-muted">{running ? busy : blocked ? 'Fix the errors to test the script.' : idle}</span>
    </div>
  );
}

/** A failed test, said plainly. */
export function RunFailure({ message }: { message: string }) {
  return <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-[13px] text-fg">{message}</p>;
}
