'use client';

import { useState } from 'react';
import type { RacingBlueprint } from '@/engine/blueprints/types';
import { loadChampion } from '@/storage/generations';
import type { Analysis } from '../../doc/analyze';
import { useRacingChampions, type ChampionSource } from '../useRacingChampions';
import { RunBar, RunFailure } from './RunBar';
import { TestRunControls, type TestSettings } from './TestRunControls';
import { TestRunResultView } from './TestRunResultView';
import { runInWorker } from './testRunClient';
import type { TestBrain, TestRunOk } from './types';
import { useTestJob } from './useTestJob';

async function championBrain(source: ChampionSource): Promise<TestBrain | string> {
  const genome = await loadChampion(source.run.id, source.latest);
  const racing = source.run.config.racing;
  if (!genome || !racing) return 'That champion could not be loaded. Its run may have been deleted.';
  return { kind: 'champion', genome, blueprint: source.run.config.blueprint as RacingBlueprint, car: racing.car, maxTime: racing.maxTime, label: source.run.name };
}

/** Drives one car with the open racing script in a worker and shows what happened tick by tick. */
export function RacingTestRun({ text, analysis }: { text: string; analysis: Analysis }) {
  const { sources } = useRacingChampions();
  const [settings, setSettings] = useState<TestSettings>({ trackId: 'oval', brain: 'random', seed: 1, runId: null });
  const job = useTestJob<TestRunOk>();

  const run = () =>
    job.start(async (signal) => {
      let brain: TestBrain | string = { kind: 'random', seed: settings.seed };
      if (settings.brain === 'champion') {
        const source = sources.find((s) => s.run.id === settings.runId) ?? sources[0];
        brain = source ? await championBrain(source) : 'Pick a run with a champion first.';
      }
      if (typeof brain === 'string') return { ok: false, message: brain };
      return runInWorker({ source: text, trackId: settings.trackId, brain, seed: settings.seed }, signal);
    });

  return (
    <>
      <TestRunControls value={settings} onChange={setSettings} sources={sources} disabled={job.running} />
      <RunBar running={job.running} blocked={analysis.counts.error > 0} label="Run one episode" busy="Driving..." idle="One car, up to 60 s." onRun={() => void run()} onCancel={job.cancel} />
      {job.result && !job.result.ok && <RunFailure message={job.result.message} />}
      {job.result && job.result.ok && <TestRunResultView result={job.result} estimate={analysis.micros} />}
    </>
  );
}
