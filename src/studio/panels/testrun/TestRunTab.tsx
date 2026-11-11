'use client';

import { DEFAULT_SCRIPT_ENV } from '@/engine/script';
import { analyze } from '../../doc/analyze';
import { selectText, useStudio } from '../../state/studioStore';
import { EpisodeTestRun } from './episode/EpisodeTestRun';
import { HideSeekTestRun } from './hideseek/HideSeekTestRun';
import { RacingTestRun } from './RacingTestRun';

/**
 * Runs the open script once in a worker and shows what happened tick by
 * tick: one car for a racing script, one match for a Hide and Seek script,
 * one agent with the env's test brain for any other env.
 */
export default function TestRunTab() {
  const text = useStudio(selectText);
  const a = analyze(text);
  // A script without a valid header is shown as one for the env the Studio offers first, which explains what to fix.
  const env = a.env ?? DEFAULT_SCRIPT_ENV;
  const panel = env === 'hideseek' ? <HideSeekTestRun text={text} analysis={a} /> : env === 'racing' ? <RacingTestRun text={text} analysis={a} /> : <EpisodeTestRun text={text} analysis={a} />;
  return <div className="flex flex-col gap-5 p-4">{panel}</div>;
}
