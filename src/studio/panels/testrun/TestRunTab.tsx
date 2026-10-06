'use client';

import { CircleAlert } from 'lucide-react';
import { analyze } from '../../doc/analyze';
import { selectText, useStudio } from '../../state/studioStore';
import { RacingTestRun } from './RacingTestRun';

/**
 * Runs the open script once in a worker and shows what happened tick by
 * tick. Hide and Seek scripts get a clear note instead of a run.
 */
export default function TestRunTab() {
  const text = useStudio(selectText);
  const a = analyze(text);
  return (
    <div className="flex flex-col gap-5 p-4">
      {a.env === 'hideseek' ? (
        <p className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3 text-[13px] text-muted">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-accent" />
          Test runs for Hide and Seek scripts are not ready yet. The editor still checks the script and you can save it.
        </p>
      ) : (
        <RacingTestRun text={text} analysis={a} />
      )}
    </div>
  );
}
