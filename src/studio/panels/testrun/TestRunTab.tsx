'use client';

import { analyze } from '../../doc/analyze';
import { selectText, useStudio } from '../../state/studioStore';
import { HideSeekTestRun } from './hideseek/HideSeekTestRun';
import { RacingTestRun } from './RacingTestRun';

/**
 * Runs the open script once in a worker and shows what happened tick by
 * tick: one car for a racing script, one match for a Hide and Seek script.
 */
export default function TestRunTab() {
  const text = useStudio(selectText);
  const a = analyze(text);
  return <div className="flex flex-col gap-5 p-4">{a.env === 'hideseek' ? <HideSeekTestRun text={text} analysis={a} /> : <RacingTestRun text={text} analysis={a} />}</div>;
}
