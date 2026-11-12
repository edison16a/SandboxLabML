'use client';

import { analyze } from '../../doc/analyze';
import { selectText, useStudio } from '../../state/studioStore';
import { EpisodeTestRun } from './episode/EpisodeTestRun';

/**
 * Runs the open script once in a worker and shows what happened tick by
 * tick: one agent driven by the env's fixed test brain, the same episode
 * a lesson check runs.
 */
export default function TestRunTab() {
  const text = useStudio(selectText);
  return (
    <div className="flex flex-col gap-5 p-4">
      <EpisodeTestRun text={text} analysis={analyze(text)} />
    </div>
  );
}
