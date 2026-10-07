'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { Kbd } from '@/ui/primitives/Kbd';
import type { StepText, WalkStep } from './types';

interface Props {
  step: WalkStep;
  text: StepText;
  acted: boolean;
  number: number;
  count: number;
  titleId: string;
  bodyId: string;
  /** Called when one of the closing links is followed. */
  onLeave: () => void;
}

/** What the user is asked to do, then a short confirmation once it is done. */
function ActionRow({ step, acted }: { step: WalkStep; acted: boolean }) {
  const action = step.action;
  if (!action) return null;
  if (acted) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[12px] font-medium text-success">
        <CircleCheck className="size-4" />
        {action.doneLabel}
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-accent/35 bg-accent-soft px-3 py-2">
      <span className="relative flex size-2 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
      <span className="text-[13px] font-medium text-fg">{action.prompt}</span>
      {/* A phone or tablet has no keys to press, so the shortcut only shows with a mouse. */}
      {action.shortcut && (
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-subtle pointer-coarse:hidden">
          or <Kbd>{action.shortcut}</Kbd>
        </span>
      )}
    </div>
  );
}

/**
 * The words of one step: its chapter and place in the tour, a title, one
 * or two sentences, the technical terms it uses and what to do.
 */
export function StepBody({ step, text, acted, number, count, titleId, bodyId, onLeave }: Props) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-accent uppercase">{step.chapter ?? 'Next steps'}</span>
        <span className="tabular font-mono text-[11px] text-subtle">
          {number} / {count}
        </span>
      </div>
      <h2 id={titleId} className="mt-2 text-[15px] leading-snug font-semibold text-fg">
        {text.title}
      </h2>
      <p id={bodyId} className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {text.body}
      </p>
      {text.terms && (
        <dl className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
          {text.terms.map((t) => (
            <div key={t.term} className="text-[12px] leading-snug">
              <dt className="inline font-semibold text-fg">{t.term}. </dt>
              <dd className="inline text-muted">{t.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
      <ActionRow step={step} acted={acted} />
      {step.links && (
        <div className="mt-3 flex flex-wrap gap-2">
          {step.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              onClick={onLeave}
              className="inline-flex h-8 items-center rounded-md border border-border-strong px-3 text-[12px] font-medium text-fg transition-colors hover:bg-surface-3"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
