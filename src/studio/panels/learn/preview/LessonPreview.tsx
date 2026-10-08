'use client';

import { useRef } from 'react';
import { LoaderCircle, Pause, Play, RotateCcw } from 'lucide-react';
import type { EnvId } from '@/engine/env/types';
import type { Lesson, LessonStep } from '@/engine/lessons/types';
import { Button } from '@/ui/primitives/Button';
import { analyze } from '../../../doc/analyze';
import { usePlayback } from './usePlayback';
import { usePreview } from './usePreview';

const CAPTION: Record<EnvId, string> = {
  racing: 'The drive a check runs, with a fixed test brain.',
  hideseek: 'The match a check plays, with fixed test players. Hider blue, seeker red.',
};

const GAME: Record<EnvId, string> = { racing: 'racing', hideseek: 'Hide and Seek' };

const LABEL: Record<EnvId, string> = {
  racing: 'Top view of the test drive: the track, the car, its trail and its rays',
  hideseek: "Top view of the test match: the room, the boxes, both players and the seeker's view",
};

interface Props {
  lesson: Lesson;
  step: LessonStep;
  text: string;
}

/**
 * A small live view beside a lesson that plays the script in the editor
 * with the same fixed brain the checks use, and plays it again after
 * each edit that compiles. While the editor holds no script for the
 * lesson's game, it plays the step's starter instead.
 */
export function LessonPreview({ lesson, step, text }: Props) {
  const own = analyze(text).env === lesson.course;
  const state = usePreview(own ? text : step.starter);
  const canvas = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const { playing, toggle, restart } = usePlayback(state.preview, canvas, readout);
  const status = state.busy ? 'Updating...' : state.broken && state.preview ? 'Showing the last version that compiled' : null;

  return (
    <section className="flex flex-col gap-2" aria-label="Preview">
      <div className="flex items-center gap-2">
        <h4 className="text-[12px] font-semibold tracking-wide text-muted uppercase">Preview</h4>
        <span className="min-w-0 flex-1 truncate text-[11px] text-subtle" aria-live="polite">
          {state.busy && <LoaderCircle className="mr-1 inline size-3 animate-spin align-[-2px]" />}
          {status}
        </span>
        <Button size="icon-sm" variant="ghost" onClick={toggle} disabled={!state.preview} aria-label={playing ? 'Pause preview' : 'Play preview'} title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={restart} disabled={!state.preview} aria-label="Restart preview" title="Restart">
          <RotateCcw />
        </Button>
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-bg">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" role="img" aria-label={LABEL[lesson.course]} />
        {!state.preview && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-[12px] text-muted">
            {state.message ?? (state.broken ? 'Fix the errors in the script to see it play.' : 'Simulating...')}
          </p>
        )}
        <span ref={readout} className="tabular pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-bg/80 px-1.5 py-0.5 font-mono text-[11px] text-muted empty:hidden" aria-hidden="true" />
      </div>
      <p className="text-[11px] text-subtle">
        {CAPTION[lesson.course]}
        {!own && ` Playing the starter, since the editor holds no ${GAME[lesson.course]} script.`}
      </p>
    </section>
  );
}
