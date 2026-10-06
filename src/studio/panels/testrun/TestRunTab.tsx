'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Play, Square } from 'lucide-react';
import type { RacingBlueprint } from '@/engine/blueprints/types';
import { loadChampion } from '@/storage/generations';
import { Button } from '@/ui/primitives/Button';
import { analyze } from '../../doc/analyze';
import { selectText, useStudio } from '../../state/studioStore';
import { useRacingChampions, type ChampionSource } from '../useRacingChampions';
import { TestRunControls, type TestSettings } from './TestRunControls';
import { TestRunResultView } from './TestRunResultView';
import { runInWorker } from './testRunClient';
import type { TestBrain, TestRunResult } from './types';

async function championBrain(source: ChampionSource): Promise<TestBrain | string> {
  const genome = await loadChampion(source.run.id, source.latest);
  const racing = source.run.config.racing;
  if (!genome || !racing) return 'That champion could not be loaded. Its run may have been deleted.';
  return { kind: 'champion', genome, blueprint: source.run.config.blueprint as RacingBlueprint, car: racing.car, maxTime: racing.maxTime, label: source.run.name };
}

/**
 * Drives one car with the open script in a worker and shows what happened
 * tick by tick. Hide and Seek scripts get a clear note instead of a run.
 */
export default function TestRunTab() {
  const text = useStudio(selectText);
  const a = analyze(text);
  const { sources } = useRacingChampions();
  const [settings, setSettings] = useState<TestSettings>({ trackId: 'oval', brain: 'random', seed: 1, runId: null });
  const [result, setResult] = useState<TestRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const hideSeek = a.env === 'hideseek';
  const run = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setRunning(true);
    try {
      let brain: TestBrain | string = { kind: 'random', seed: settings.seed };
      if (settings.brain === 'champion') {
        const source = sources.find((s) => s.run.id === settings.runId) ?? sources[0];
        brain = source ? await championBrain(source) : 'Pick a run with a champion first.';
      }
      if (typeof brain === 'string') setResult({ ok: false, message: brain });
      else setResult(await runInWorker({ source: text, trackId: settings.trackId, brain, seed: settings.seed }, ctrl.signal));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (abort.current === ctrl) setRunning(false);
    }
  };
  const cancel = () => {
    abort.current?.abort();
    setRunning(false);
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      {hideSeek ? (
        <p className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3 text-[13px] text-muted">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-accent" />
          Test runs for Hide and Seek scripts are not ready yet. The editor still checks the script and you can save it.
        </p>
      ) : (
        <>
          <TestRunControls value={settings} onChange={setSettings} sources={sources} disabled={running} />
          <div className="flex items-center gap-2">
            {running ? (
              <Button variant="outline" onClick={cancel}>
                <Square />
                Cancel
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void run()} disabled={a.counts.error > 0}>
                <Play />
                Run one episode
              </Button>
            )}
            <span className="text-[12px] text-muted">{running ? 'Driving...' : a.counts.error > 0 ? 'Fix the errors to test the script.' : 'One car, up to a minute of driving.'}</span>
          </div>
        </>
      )}
      {result && !result.ok && <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-[13px] text-fg">{result.message}</p>}
      {result && result.ok && <TestRunResultView result={result} estimate={a.micros} />}
    </div>
  );
}
