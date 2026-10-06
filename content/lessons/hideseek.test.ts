import { describe, expect, it } from 'vitest';
import { findLesson, lessonsFor, LESSONS } from '@/engine/lessons/catalog';
import { evaluateCheck } from '@/engine/lessons/evaluate';
import { validateLesson } from '@/engine/lessons/validate';
import { compileScript } from '@/engine/script/compiler';
import { findScriptPreset } from '@/engine/script/presets/racing';

const course = lessonsFor('hideseek');

describe('the Hide and Seek course', () => {
  it('has six lessons in order', () => {
    expect(course.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    expect(findLesson(course[0].id)).toBe(course[0]);
  });

  for (const lesson of course) {
    it(`${lesson.title} validates`, () => {
      expect(validateLesson(lesson)).toEqual([]);
    });
  }

  it('ends with a script that is the Intermediate preset', () => {
    const last = course[course.length - 1];
    const final = compileScript(last.steps[last.steps.length - 1].solution).script;
    const preset = compileScript(findScriptPreset('hideseek-intermediate')?.source ?? '').script;
    expect(final?.sourceHash).toBeDefined();
    expect(final?.sourceHash).toBe(preset?.sourceHash);
  });
});

/**
 * Every starter compiles and fails its own check, so each step asks the
 * learner to do something. Every solution passes. Test matches and
 * training play real Rapier matches with small teams, which makes this
 * the slow part of the suite, around half a minute in all.
 */
describe.each(course.map((l) => [l.title, l] as const))('%s steps', (_title, lesson) => {
  for (const step of lesson.steps) {
    it(`${step.id}: the starter compiles and fails, the solution passes`, async () => {
      for (const source of [step.starter, step.solution]) {
        const errors = compileScript(source).diagnostics.filter((d) => d.severity === 'error');
        expect(errors, source).toEqual([]);
      }
      const before = await evaluateCheck(step.check, step.starter);
      const after = await evaluateCheck(step.check, step.solution);
      expect(before.passed, before.message).toBe(false);
      expect(after.passed, after.message).toBe(true);
    });
  }
});
