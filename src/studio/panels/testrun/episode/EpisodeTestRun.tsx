'use client';

import { useMemo } from 'react';
import type { EpisodePreview } from '@/engine/lessons/preview/types';
import { Stat } from '@/ui/primitives/Panel';
import type { Analysis } from '../../../doc/analyze';
import { ResultSection } from '../ResultSection';
import { RewardChart } from '../RewardChart';
import { RunBar, RunFailure } from '../RunBar';
import { recordInWorker, runEpisodeInWorker } from '../testRunClient';
import { TickTable, type TickColumn } from '../TickTable';
import { useTestJob } from '../useTestJob';
import { EpisodeReplay } from './EpisodeReplay';
import type { EpisodeTestResult, EpisodeTickLog } from './run';

/** A finished test episode, with its recording for the replay when the env has a top view to draw. */
type Ok = Extract<EpisodeTestResult, { ok: true }> & { preview: EpisodePreview | null };

/** Ticks of an episode test: the points each gave and the running total. Ticks with points count as notable. */
function Ticks({ log }: { log: EpisodeTickLog }) {
  const columns = useMemo<TickColumn[]>(
    () => [
      { label: 'Reward', values: log.reward, digits: 3, tone: 'signed' },
      { label: 'Total', values: log.total, digits: 2 },
    ],
    [log],
  );
  const notable = useMemo(() => (t: number) => Math.abs(log.reward[t]) >= 1e-9, [log]);
  return <TickTable time={log.time} columns={columns} events={log.events} notable={notable} filterLabel="Only ticks with points or events" />;
}

/**
 * Test run for a script of an env added through the registry: one agent
 * driven by the env's fixed test brain, the episode a lesson check runs.
 */
export function EpisodeTestRun({ text, analysis }: { text: string; analysis: Analysis }) {
  const job = useTestJob<Ok>();
  const run = () =>
    job.start(async (signal) => {
      const result = await runEpisodeInWorker(text, signal);
      if (!result.ok) return result;
      // The same episode recorded for the replay. A recording that fails only leaves the replay out.
      const recorded = await recordInWorker(text, signal);
      return { ...result, preview: recorded.ok && recorded.preview.kind === 'episode' ? recorded.preview : null };
    });
  const result = job.result;
  return (
    <>
      <RunBar running={job.running} blocked={analysis.counts.error > 0} label="Run one episode" busy="Running..." idle="One agent with the fixed test brain." onRun={() => void run()} onCancel={job.cancel} />
      {result && !result.ok && <RunFailure message={result.message} />}
      {result && result.ok && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Stopped by" value={<span className="font-sans">{result.stopReason}</span>} />
            <Stat label="Total reward" value={result.totalReward.toFixed(2)} />
            {result.metrics.slice(0, 2).map((m) => (
              <Stat key={m.label} label={m.label} value={m.value} />
            ))}
          </div>
          {result.preview && result.preview.scene !== null && (
            <ResultSection title="Replay" hint="from above, at real time">
              <EpisodeReplay preview={result.preview} />
            </ResultSection>
          )}
          <ResultSection title="Reward" hint={`${(result.ticks / result.tickHz).toFixed(1)} s with ${result.blueprint}`}>
            <RewardChart log={result.log} />
          </ResultSection>
          <ResultSection title="Ticks">
            <Ticks log={result.log} />
          </ResultSection>
        </div>
      )}
    </>
  );
}
