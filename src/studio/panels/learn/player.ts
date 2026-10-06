import type { CheckOutcome, Lesson } from '@/engine/lessons/types';

export type HintRung = 0 | 1 | 2 | 3;

export type CheckState = { status: 'idle' } | { status: 'running'; progress: number } | { status: 'done'; outcome: CheckOutcome };

/** Where the learner is in a lesson. Pure data, so the rules below can be tested without React. */
export interface PlayerState {
  step: number;
  /** Highest step the learner may open: steps unlock as checks pass. */
  unlocked: number;
  /** Hints shown so far: 1 and 2 are the hints, 3 is the solution. */
  hints: HintRung;
  check: CheckState;
  completed: boolean;
}

export type PlayerAction =
  | { type: 'goto'; step: number }
  | { type: 'hint' }
  | { type: 'checkStart' }
  | { type: 'checkProgress'; fraction: number }
  | { type: 'checkDone'; outcome: CheckOutcome }
  | { type: 'checkCancel' };

/** Opens a lesson where the learner left it, from the saved progress. */
export function openPlayer(lesson: Lesson, saved?: { step: number; completed: boolean }): PlayerState {
  const last = Math.max(0, lesson.steps.length - 1);
  const unlocked = Math.min(saved?.step ?? 0, last);
  return { step: unlocked, unlocked, hints: 0, check: { status: 'idle' }, completed: saved?.completed ?? false };
}

const fresh = { hints: 0 as HintRung, check: { status: 'idle' } as CheckState };

/**
 * Lesson rules: steps open in order as checks pass, the hint ladder climbs
 * one rung at a time and resets per step, and a check result belongs to
 * the step it ran on.
 */
export function reducePlayer(s: PlayerState, a: PlayerAction, lesson: Lesson): PlayerState {
  switch (a.type) {
    case 'goto':
      if (a.step < 0 || a.step > s.unlocked || a.step >= lesson.steps.length || a.step === s.step) return s;
      return { ...s, step: a.step, ...fresh };
    case 'hint':
      return { ...s, hints: Math.min(3, s.hints + 1) as HintRung };
    case 'checkStart':
      return { ...s, check: { status: 'running', progress: 0 } };
    case 'checkProgress':
      return s.check.status === 'running' ? { ...s, check: { status: 'running', progress: Math.max(0, Math.min(1, a.fraction)) } } : s;
    case 'checkCancel':
      return { ...s, check: { status: 'idle' } };
    case 'checkDone': {
      if (!a.outcome.passed) return { ...s, check: { status: 'done', outcome: a.outcome } };
      const last = s.step === lesson.steps.length - 1;
      const unlocked = Math.max(s.unlocked, Math.min(s.step + 1, lesson.steps.length - 1));
      return { ...s, unlocked, completed: s.completed || last, check: { status: 'done', outcome: a.outcome } };
    }
  }
}

/** Share of the lesson done, for progress bars in the lesson list. */
export function lessonFraction(lesson: Lesson, saved?: { step: number; completed: boolean }): number {
  if (!saved) return 0;
  if (saved.completed) return 1;
  return lesson.steps.length === 0 ? 0 : Math.min(1, saved.step / lesson.steps.length);
}
