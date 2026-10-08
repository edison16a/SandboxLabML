import { describe, expect, it } from 'vitest';
import { actedOnEntry, announcement, backIndex, chapterSizes, isLast, nextIndex, positionOf, shouldAutoStart, stepAt, textOf, DONE_MARK } from './flow';
import type { Tour, WalkStep } from './types';

let trained = false;

const train: WalkStep = {
  id: 'train',
  chapter: 'Learn',
  target: '[data-tour="train"]',
  prefer: ['top'],
  title: 'Press it',
  body: 'Starts training.',
  action: {
    prompt: 'Press Train',
    done: () => trained,
    doneLabel: 'Training',
    then: { target: '[data-tour="viewport"]', title: 'Look', body: 'Cars drive.' },
  },
};

const tour: Tour = {
  id: 't',
  storageKey: 'k',
  intro: { title: 'Hi', body: 'A tour.', icon: null, chapters: [{ label: 'Learn', icon: null }, { label: 'Run', icon: null }] },
  steps: [
    train,
    { id: 'chart', chapter: 'Learn', target: '[data-tour="chart"]', fallback: '[data-tour="panel"]', title: 'Chart', body: 'It climbs.' },
    { id: 'net', chapter: 'Run', title: 'Net', body: 'It runs.', action: { prompt: 'Open it', done: () => false, doneLabel: 'Open', then: { title: 'Lit', body: 'Links light.', prefer: ['left'] } } },
    { id: 'end', title: 'End', body: 'Bye.' },
  ],
};

describe('positions', () => {
  it('starts on the welcome card and counts steps from one', () => {
    expect(positionOf(tour, 0)).toEqual({ kind: 'intro' });
    expect(positionOf(tour, 1)).toMatchObject({ kind: 'step', number: 1, count: 4, step: train });
    expect(stepAt(tour, 0)).toBeNull();
    expect(stepAt(tour, 4)?.id).toBe('end');
  });

  it('moves forward until the last step, then finishes', () => {
    expect(nextIndex(tour, 0)).toBe(1);
    expect(nextIndex(tour, 3)).toBe(4);
    expect(nextIndex(tour, 4)).toBeNull();
    expect(isLast(tour, 4)).toBe(true);
    expect(isLast(tour, 3)).toBe(false);
  });

  it('goes back but not past the welcome card', () => {
    expect(backIndex(2)).toBe(1);
    expect(backIndex(0)).toBe(0);
  });

  it('counts the steps of each chapter', () => {
    expect(chapterSizes(tour)).toEqual([2, 1]);
  });
});

describe('textOf', () => {
  it('shows the step itself until its action is done', () => {
    expect(textOf(train, false)).toBe(train);
  });

  it('switches to the follow up text and its own frame once done', () => {
    const t = textOf(train, true);
    expect(t.title).toBe('Look');
    expect(t.target).toBe('[data-tour="viewport"]');
    expect(t.prefer).toEqual(['top']);
  });

  it('keeps the step frame when the follow up names none', () => {
    const net = tour.steps[2];
    const t = textOf(net, true);
    expect(t.title).toBe('Lit');
    expect(t.target).toBe(net.target);
    expect(t.prefer).toEqual(['left']);
  });

  it('ignores the acted flag on a step without an action', () => {
    expect(textOf(tour.steps[1], true)).toBe(tour.steps[1]);
  });
});

describe('actions', () => {
  it('counts an action done before the step opened, as on a replay', () => {
    trained = false;
    expect(actedOnEntry(train)).toBe(false);
    trained = true;
    expect(actedOnEntry(train)).toBe(true);
    expect(actedOnEntry(null)).toBe(false);
    expect(actedOnEntry(tour.steps[1])).toBe(false);
  });
});

describe('announcement', () => {
  it('reads the step number, the text and what to do', () => {
    expect(announcement(tour, 0, false)).toBe('Hi. A tour.');
    expect(announcement(tour, 1, false)).toBe('Step 1 of 4. Press it. Starts training. Press Train.');
    expect(announcement(tour, 1, true)).toBe('Step 1 of 4. Look. Cars drive.');
  });
});

describe('shouldAutoStart', () => {
  it('starts until the tour was finished or skipped', () => {
    expect(shouldAutoStart(null)).toBe(true);
    expect(shouldAutoStart('0')).toBe(true);
    expect(shouldAutoStart(DONE_MARK)).toBe(false);
  });
});
