'use client';

import { useMemo, useState } from 'react';
import { TEST_MATCH_SEED } from '@/engine/lessons/hideseek/rules';
import type { Analysis } from '../../../doc/analyze';
import { RunBar, RunFailure } from '../RunBar';
import { runMatchInWorker } from '../testRunClient';
import { useTestJob } from '../useTestJob';
import { MatchControls, type MatchSettings } from './MatchControls';
import { MatchResultView } from './MatchResultView';
import { defaultRoom, scriptRooms } from './rooms';
import type { MatchTestOk } from './types';

/**
 * Plays one match of the open Hide and Seek script in a worker, with the
 * script's own each tick block for both players, and shows both teams'
 * rewards tick by tick. The room follows the script's first room until
 * the user picks another.
 */
export function HideSeekTestRun({ text, analysis }: { text: string; analysis: Analysis }) {
  const named = useMemo(() => scriptRooms(analysis.parsed.program), [analysis]);
  const [settings, setSettings] = useState<MatchSettings>({ layout: null, brains: 'test', seed: TEST_MATCH_SEED });
  const room = settings.layout ?? defaultRoom(named);
  const job = useTestJob<MatchTestOk>();
  const run = () => job.start((signal) => runMatchInWorker({ source: text, layout: room, brains: settings.brains, seed: settings.seed }, signal));

  return (
    <>
      <MatchControls value={settings} onChange={setSettings} named={named} room={room} disabled={job.running} />
      <RunBar running={job.running} blocked={analysis.counts.error > 0} label="Play one match" busy="Playing the match..." idle="One 30 s match." onRun={() => void run()} onCancel={job.cancel} />
      {job.result && !job.result.ok && <RunFailure message={job.result.message} />}
      {job.result && job.result.ok && <MatchResultView result={job.result} estimate={analysis.micros} />}
    </>
  );
}
