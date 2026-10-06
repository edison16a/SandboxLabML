'use client';

import { useEffect, useReducer, useRef } from 'react';
import { ArrowLeft, Check, Download } from 'lucide-react';
import { evaluateCheck } from '@/engine/lessons/evaluate';
import type { Lesson } from '@/engine/lessons/types';
import { saveLessonProgress, type LessonProgress } from '@/storage/lessonProgress';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { selectText, useStudio } from '../../state/studioStore';
import { CheckBox } from './CheckBox';
import { HintLadder } from './HintLadder';
import { applySolution, loadStarter } from './lessonActions';
import { Markdown } from './Markdown';
import { openPlayer, reducePlayer, type PlayerAction, type PlayerState } from './player';

interface Props {
  lesson: Lesson;
  saved?: LessonProgress;
  onBack: () => void;
  onProgress: () => void;
}

/** One lesson, a step at a time: the text, a starter, a check, and hints that end in the solution. */
export function LessonPlayer({ lesson, saved, onBack, onProgress }: Props) {
  const text = useStudio(selectText);
  const [state, dispatch] = useReducer((s: PlayerState, a: PlayerAction) => reducePlayer(s, a, lesson), saved, (p) => openPlayer(lesson, p));
  const abort = useRef<AbortController | null>(null);
  const step = lesson.steps[state.step];

  useEffect(() => {
    useStudio.setState({ highlightLines: step?.highlight?.lines ?? [] });
    return () => useStudio.setState({ highlightLines: [] });
  }, [step]);
  useEffect(() => () => abort.current?.abort(), []);

  if (!step) return <p className="p-4 text-[13px] text-muted">This lesson has no steps yet.</p>;

  const check = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    dispatch({ type: 'checkStart' });
    try {
      const outcome = await evaluateCheck(step.check, text, { signal: ctrl.signal, onProgress: (f) => dispatch({ type: 'checkProgress', fraction: f }) });
      if (ctrl.signal.aborted) return;
      dispatch({ type: 'checkDone', outcome });
      if (outcome.passed) {
        const last = state.step === lesson.steps.length - 1;
        await saveLessonProgress(lesson.id, { step: last ? state.step : state.step + 1, completed: last, source: text });
        onProgress();
      }
    } catch (err) {
      if (!ctrl.signal.aborted) dispatch({ type: 'checkDone', outcome: { passed: false, message: err instanceof Error ? err.message : String(err) } });
    }
  };
  const cancel = () => {
    abort.current?.abort();
    dispatch({ type: 'checkCancel' });
  };
  const passed = state.check.status === 'done' && state.check.outcome.passed;
  const hasNext = state.step < lesson.steps.length - 1;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label="All lessons">
          <ArrowLeft />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{lesson.title}</h2>
        {state.completed && <span className="text-[12px] text-success">Completed</span>}
      </div>
      <ol className="flex flex-wrap gap-1.5" aria-label="Steps">
        {lesson.steps.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={i > state.unlocked}
              aria-current={i === state.step ? 'step' : undefined}
              onClick={() => dispatch({ type: 'goto', step: i })}
              className={cn('inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border px-2 text-[12px] disabled:opacity-40', i === state.step ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:border-border-strong')}
              title={s.title}
            >
              {i < state.unlocked || (state.completed && i === state.unlocked) ? <Check className="size-3 text-success" /> : null}
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <section className="flex flex-col gap-3">
        <h3 className="text-[15px] font-semibold">{step.title}</h3>
        <Markdown source={step.body} />
        <Button variant="outline" className="self-start" onClick={() => void loadStarter(lesson, step)}>
          <Download />
          Load starter
        </Button>
      </section>
      <CheckBox check={state.check} onCheck={() => void check()} onCancel={cancel} onNext={passed && hasNext ? () => dispatch({ type: 'goto', step: state.step + 1 }) : null} />
      <HintLadder step={step} rung={state.hints} current={text} onNext={() => dispatch({ type: 'hint' })} onApply={() => applySolution(step.solution)} />
    </div>
  );
}
