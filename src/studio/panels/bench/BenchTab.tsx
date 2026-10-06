'use client';

import { useEffect, useRef, useState } from 'react';
import { Gauge, Square } from 'lucide-react';
import { loadReferences, runBenchmark } from '@/engine/bench';
import type { BenchReferences, BenchResult } from '@/engine/bench/types';
import { Button } from '@/ui/primitives/Button';
import { Field } from '@/ui/primitives/Field';
import { Select } from '@/ui/primitives/Select';
import { BenchResultCard } from './BenchResultCard';
import { generationsOf, loadModel, saveScore, useBenchSources } from './benchSource';

const ENV_NAMES = { racing: 'Racing', hideseek: 'Hide and Seek' } as const;

type Outcome = { kind: 'result'; result: BenchResult; references: BenchReferences | null; generation: number } | { kind: 'message'; text: string };

/**
 * Scores a stored champion on the benchmark for its environment and shows
 * how it compares with the reference presets. A Racing run is scored by
 * its champion, a Hide and Seek run by the champion pair of a generation.
 */
export default function BenchTab() {
  const { sources, loading } = useBenchSources();
  const [runId, setRunId] = useState<string | null>(null);
  const [generations, setGenerations] = useState<number[]>([]);
  const [generation, setGeneration] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const abort = useRef<AbortController | null>(null);
  const source = sources.find((s) => s.run.id === runId) ?? sources[0];

  useEffect(() => {
    if (!source) return;
    let live = true;
    void generationsOf(source.run).then((list) => {
      if (!live) return;
      setGenerations(list);
      setGeneration(list[list.length - 1] ?? null);
    });
    return () => {
      live = false;
    };
  }, [source]);
  useEffect(() => () => abort.current?.abort(), []);

  const run = async () => {
    if (!source || generation === null) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setProgress(0);
    setOutcome(null);
    try {
      const model = await loadModel(source.run, generation);
      if (!model) throw new Error('That champion could not be loaded.');
      const result = await runBenchmark(source.run.config, model, { signal: ctrl.signal, onProgress: setProgress });
      if (ctrl.signal.aborted) return;
      if (!result) {
        setOutcome({ kind: 'message', text: 'This run could not be benchmarked.' });
        return;
      }
      await saveScore(source.run, generation, result.score).catch(() => undefined);
      setOutcome({ kind: 'result', result, references: await loadReferences(source.run.env), generation });
    } catch (err) {
      if (!ctrl.signal.aborted) setOutcome({ kind: 'message', text: err instanceof Error ? err.message : String(err) });
    } finally {
      if (abort.current === ctrl) setProgress(null);
    }
  };
  const cancel = () => {
    abort.current?.abort();
    setProgress(null);
  };

  if (!loading && sources.length === 0) {
    return <p className="m-4 rounded-md border border-dashed border-border p-4 text-center text-[13px] text-muted">No runs with a champion yet. Train a run in the Racing or Hide and Seek lab, then benchmark its champion here.</p>;
  }
  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="Run">
        <Select label="Run" value={source?.run.id ?? ''} disabled={progress !== null} onChange={(id) => setRunId(id)} options={sources.map((s) => ({ value: s.run.id, label: s.run.name, hint: `${ENV_NAMES[s.run.env]}, ${s.latest + 1} generations` }))} />
      </Field>
      <Field label="Champion of generation" hint={source?.run.env === 'hideseek' ? 'Defaults to the latest generation. Its hider and seeker champions play together.' : 'Defaults to the latest champion.'}>
        <Select
          label="Generation"
          value={generation === null ? '' : String(generation)}
          disabled={progress !== null || generations.length === 0}
          onChange={(g) => setGeneration(Number(g))}
          options={[...generations].reverse().map((g) => ({ value: String(g), label: `Generation ${g + 1}` }))}
        />
      </Field>
      {progress === null ? (
        <Button variant="primary" className="self-start" disabled={!source || generation === null} onClick={() => void run()}>
          <Gauge />
          Run benchmark
        </Button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Benchmark progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
          <Button size="sm" variant="outline" onClick={cancel}>
            <Square />
            Cancel
          </Button>
        </div>
      )}
      {outcome?.kind === 'message' && <p className="rounded-md border border-border bg-surface-2 p-3 text-[13px] text-muted">{outcome.text}</p>}
      {outcome?.kind === 'result' && <BenchResultCard result={outcome.result} references={outcome.references} generation={outcome.generation} />}
    </div>
  );
}
