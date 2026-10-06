import { describe, expect, it } from 'vitest';
import { styleProblems } from '../style';
import type { Lesson, LessonStep } from '../types';
import { validateLesson } from '../validate';

const STARTER = 'script "t" for racing v1\neach tick {\n  drive(steer: 0, pedal: 1)\n}\n';

function step(id: string, overrides: Partial<LessonStep> = {}): LessonStep {
  return {
    id,
    title: 'A step',
    body: 'Do the thing.',
    starter: STARTER,
    highlight: { lines: [3] },
    check: { kind: 'compiles', message: 'It should compile.' },
    hints: ['First hint.', 'Second hint.'],
    solution: STARTER,
    ...overrides,
  };
}

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return { id: 'racing-test', course: 'racing', order: 1, title: 'Test', summary: 'A test lesson.', minutes: 5, steps: [step('a'), step('b'), step('c')], ...overrides };
}

describe('validateLesson', () => {
  it('accepts a well formed lesson', () => {
    expect(validateLesson(lesson())).toEqual([]);
  });

  it('enforces the course shape: 3 to 6 steps and 5 to 10 minutes', () => {
    expect(validateLesson(lesson({ steps: [step('a'), step('b')] }))).toContain('a lesson has 3 to 6 steps, this one has 2');
    expect(validateLesson(lesson({ minutes: 12 }))).toContain('minutes must be between 5 and 10');
  });

  it('catches broken steps', () => {
    const problems = validateLesson(
      lesson({
        steps: [
          step('a', { hints: ['Only one.'] as unknown as [string, string] }),
          step('a', { highlight: { lines: [40] } }),
          step('Bad Id', { solution: '' }),
        ],
      }),
    );
    expect(problems).toContain('step 1 (a): needs exactly two hints');
    expect(problems).toContain('step 2: duplicate id a');
    expect(problems).toContain('step 2 (a): highlighted line 40 is not in the starter');
    expect(problems).toContain('step 3 (Bad Id): id must be lowercase words joined by hyphens');
    expect(problems).toContain('step 3 (Bad Id): solution is empty');
  });

  it('checks that checks can be measured', () => {
    const problems = validateLesson(
      lesson({
        steps: [
          step('a', { check: { kind: 'testRun', metric: 'smiles', op: '>', value: 1, message: 'x' } }),
          step('b', { check: { kind: 'metricAbove', generations: 500, metric: 'bestDistance', value: 1, message: 'x' } }),
          step('c', { check: { kind: 'astContains', anyOf: [{ stmt: 'loop' as 'if' }], message: 'x' } }),
        ],
      }),
    );
    expect(problems).toContain('step 1 (a): a test drive cannot measure smiles');
    expect(problems).toContain('step 2 (b): generations must be a whole number from 1 to 30');
    expect(problems).toContain('step 3 (c) pattern 1: unknown statement kind loop');
  });

  it("checks Hide and Seek metrics against that course's own list", () => {
    const problems = validateLesson(
      lesson({
        course: 'hideseek',
        steps: [
          step('a', { check: { kind: 'testRun', metric: 'distance', op: '>', value: 1, message: 'x' } }),
          step('b', { check: { kind: 'metricAbove', generations: 10, metric: 'locksPerMatch', value: 0, message: 'x' } }),
          step('c', { check: { kind: 'testRun', metric: 'hiderReward', op: '>', value: 0, message: 'x' } }),
        ],
      }),
    );
    expect(problems).toEqual(['step 1 (a): a test match cannot measure distance', 'step 2 (b): generations must be a whole number from 1 to 5']);
  });

  it('applies the writing style to text and to script comments', () => {
    const problems = validateLesson(lesson({ summary: 'Fast \u2014 and fun.', steps: [step('a', { starter: `// Go -> fast\n${STARTER}` }), step('b'), step('c')] }));
    expect(problems).toContain('summary uses an em or en dash');
    expect(problems).toContain('a script comment uses an arrow in place of words');
  });
});

describe('styleProblems', () => {
  it('flags dashes, arrows and bullets used as punctuation', () => {
    expect(styleProblems('Brake first -- then turn.')).toEqual(['uses a double hyphen']);
    expect(styleProblems('Brake first - then turn.')).toEqual(['uses a dash as punctuation']);
    expect(styleProblems('Speed \u2192 points')).toEqual(['uses an arrow in place of words']);
    expect(styleProblems('Fast \u00b7 clean')).toEqual(['uses a midline dot or bullet']);
  });

  it('allows minus signs, ranges and hyphenated words', () => {
    expect(styleProblems('Steer from -1 (right) to 1, in -90 deg .. 90 deg, on a well-known road.')).toEqual([]);
  });
});
