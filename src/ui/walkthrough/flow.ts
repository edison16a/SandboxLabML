import type { StepText, Tour, WalkStep } from './types';

/**
 * Where the walkthrough stands. Index 0 is the welcome card and index i
 * is step i, so the counter on the cards reads "i of steps.length".
 */
export type Position = { kind: 'intro' } | { kind: 'step'; step: WalkStep; number: number; count: number };

/** The value the storage key holds once a tour was finished or skipped. */
export const DONE_MARK = '1';

export function positionOf(tour: Tour, index: number): Position {
  if (index <= 0) return { kind: 'intro' };
  const i = Math.min(index, tour.steps.length);
  return { kind: 'step', step: tour.steps[i - 1], number: i, count: tour.steps.length };
}

/** The index after this one, or null when this was the last step and Next finishes the tour. */
export function nextIndex(tour: Tour, index: number): number | null {
  return index < tour.steps.length ? index + 1 : null;
}

export function backIndex(index: number): number {
  return Math.max(0, index - 1);
}

export function isLast(tour: Tour, index: number): boolean {
  return index >= tour.steps.length;
}

/** The step at an index, or null for the welcome card. */
export function stepAt(tour: Tour, index: number): WalkStep | null {
  const pos = positionOf(tour, index);
  return pos.kind === 'step' ? pos.step : null;
}

/**
 * What a step shows. Once its action is done the step switches to the
 * `then` text, which keeps the step's frame and sides unless it names
 * its own.
 */
export function textOf(step: WalkStep, acted: boolean): StepText {
  const then = acted ? step.action?.then : undefined;
  if (!then) return step;
  return {
    ...then,
    target: then.target ?? step.target,
    fallback: then.target ? then.fallback : step.fallback,
    prefer: then.prefer ?? step.prefer,
  };
}

/** True when a step's action was already done as it opens, as on a replay with training running. */
export function actedOnEntry(step: WalkStep | null): boolean {
  return !!step?.action?.done();
}

/** How many steps each chapter covers, for the welcome card. */
export function chapterSizes(tour: Tour): number[] {
  return tour.intro.chapters.map((c) => tour.steps.filter((s) => s.chapter === c.label).length);
}

/** The sentence screen readers hear when a step opens or changes. */
export function announcement(tour: Tour, index: number, acted: boolean): string {
  const pos = positionOf(tour, index);
  if (pos.kind === 'intro') return `${tour.intro.title}. ${tour.intro.body}`;
  const text = textOf(pos.step, acted);
  const todo = pos.step.action && !acted ? ` ${pos.step.action.prompt}.` : '';
  return `Step ${pos.number} of ${pos.count}. ${text.title}. ${text.body}${todo}`;
}

/** True when a tour should start by itself: it was never finished or skipped in this browser. */
export function shouldAutoStart(stored: string | null): boolean {
  return stored !== DONE_MARK;
}
