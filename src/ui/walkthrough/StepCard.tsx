'use client';

import { useId, type RefObject } from 'react';
import { Button } from '@/ui/primitives/Button';
import { finishTour, goBack, goNext } from './controls';
import { IntroBody } from './IntroBody';
import { StepBody } from './StepBody';
import { positionOf, textOf } from './flow';
import type { Tour } from './types';

interface Props {
  tour: Tour;
  index: number;
  acted: boolean;
  cardRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
}

/**
 * The card beside the spotlight. useStage moves the outer box; on a phone
 * it docks to the top or bottom edge as a sheet. The words fade over when
 * the step changes, while the card itself glides to its new place.
 */
export function StepCard({ tour, index, acted, cardRef, panelRef }: Props) {
  const titleId = useId();
  const bodyId = useId();
  const pos = positionOf(tour, index);
  const intro = pos.kind === 'intro';
  const waiting = pos.kind === 'step' && !!pos.step.action && !acted;
  const last = pos.kind === 'step' && pos.number === pos.count;
  const progress = pos.kind === 'step' ? pos.number / pos.count : 0;

  return (
    <div
      ref={cardRef}
      data-place="float"
      className="group pointer-events-auto fixed top-0 left-0 w-[22.5rem] will-change-transform data-[place=sheet]:inset-x-0 data-[place=sheet]:w-auto data-[edge=bottom]:top-auto data-[edge=bottom]:bottom-0"
    >
      <div
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="walkthrough"
        className="animate-walk-in overflow-hidden rounded-xl outline-none motion-reduce:animate-fade-in border border-border-strong bg-surface-2 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.7)] group-data-[edge=bottom]:rounded-b-none group-data-[edge=bottom]:border-b-0 group-data-[edge=top]:rounded-t-none group-data-[edge=top]:border-t-0"
      >
        <div className="h-0.5 bg-border/70">
          <div className="h-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${progress * 100}%` }} />
        </div>
        <div key={`${index}:${acted}`} className="animate-walk-swap px-4 pt-4 pb-3 motion-reduce:animate-fade-in">
          {pos.kind === 'intro' ? (
            <IntroBody tour={tour} titleId={titleId} bodyId={bodyId} />
          ) : (
            <StepBody step={pos.step} text={textOf(pos.step, acted)} acted={acted} number={pos.number} count={pos.count} titleId={titleId} bodyId={bodyId} onLeave={() => finishTour(tour)} />
          )}
        </div>
        <div className="flex items-center gap-2 px-4 pt-1 pb-4 group-data-[edge=bottom]:pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!last && (
            <Button size="sm" variant="ghost" className="-ml-2.5" onClick={() => finishTour(tour)}>
              Skip tour
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!intro && (
              <Button size="sm" variant="ghost" onClick={() => goBack(tour)}>
                Back
              </Button>
            )}
            <Button data-walk-primary size={intro ? 'md' : 'sm'} variant={waiting ? 'outline' : 'primary'} className="min-w-16 justify-center" onClick={() => goNext(tour)}>
              {intro ? 'Start the tour' : last ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
