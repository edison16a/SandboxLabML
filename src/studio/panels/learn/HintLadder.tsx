'use client';

import { Lightbulb } from 'lucide-react';
import type { LessonStep } from '@/engine/lessons/types';
import { Button } from '@/ui/primitives/Button';
import { lineDiff } from './lineDiff';
import type { HintRung } from './player';

function DiffView({ before, after }: { before: string; after: string }) {
  const lines = lineDiff(before, after);
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-bg py-1.5 font-mono text-[12px] leading-relaxed" aria-label="Solution compared with your text">
      {lines.map((l, i) => (
        <div key={i} className={l.kind === 'add' ? 'bg-success/10 text-success' : l.kind === 'remove' ? 'bg-danger/10 text-danger line-through decoration-danger/50' : 'text-muted'}>
          <span className="inline-block w-5 pl-1.5 select-none">{l.kind === 'add' ? '+' : l.kind === 'remove' ? '-' : ' '}</span>
          {l.text}
        </div>
      ))}
    </pre>
  );
}

const NEXT_LABEL = ['Show a hint', 'Show another hint', 'Show the solution'];

interface Props {
  step: LessonStep;
  rung: HintRung;
  current: string;
  onNext: () => void;
  onApply: () => void;
}

/** Hint one, hint two, then the solution as a diff against the learner's text, one rung per click. */
export function HintLadder({ step, rung, current, onNext, onApply }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {rung >= 1 && <Hint n={1} text={step.hints[0]} />}
      {rung >= 2 && <Hint n={2} text={step.hints[1]} />}
      {rung >= 3 && (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-muted">Solution, compared with your text</span>
          <DiffView before={current} after={step.solution} />
          <Button size="sm" variant="outline" className="self-start" onClick={onApply}>
            Apply solution
          </Button>
        </div>
      )}
      {rung < 3 && (
        <Button size="sm" variant="ghost" className="self-start" onClick={onNext}>
          <Lightbulb />
          {NEXT_LABEL[rung]}
        </Button>
      )}
    </div>
  );
}

function Hint({ n, text }: { n: number; text: string }) {
  return (
    <p className="rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-[13px] text-fg">
      <span className="mr-1.5 font-medium text-warn">Hint {n}.</span>
      {text}
    </p>
  );
}
