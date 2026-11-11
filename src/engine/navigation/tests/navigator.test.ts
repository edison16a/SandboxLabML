import { describe, expect, it } from 'vitest';
import { buildCourse } from '../course/build';
import { generateCourse } from '../course/generate';
import { NAV_LEVELS } from '../course/levels';
import { NAMED_COURSES } from '../course/presets';
import type { CourseSpec } from '../course/types';
import { NavigationEnv } from '../env';
import { IDLE_BRAIN, navigatorController } from '../navigator/navigator';
import { STANDARD_NAVIGATION_INPUTS } from '../sensors/inputConfig';
import { params } from './helpers';

/** Runs `n` perfect navigators from different start spots and returns their results. */
function walk(spec: CourseSpec, n = 12) {
  const course = buildCourse(spec, params);
  const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: navigatorController(course, params) });
  env.reset(
    Array.from({ length: n }, () => IDLE_BRAIN),
    Array.from({ length: n }, (_, i) => 500 + i * 31),
  );
  while (!env.done) env.step();
  return env.results();
}

describe('scripted navigator', () => {
  for (const spec of NAMED_COURSES) {
    it(`finishes ${spec.name} every time`, () => {
      for (const r of walk(spec)) {
        expect(r.stopReason).toBe('finished');
        expect(r.fitness).toBeGreaterThan(19);
      }
    });
  }

  for (const lv of NAV_LEVELS) {
    it(`finishes generated level ${lv.level} courses without dying`, () => {
      for (let seed = 100; seed < 112; seed++) {
        for (const r of walk(generateCourse(lv.level, seed), 6)) expect(r.stopReason).toBe('finished');
      }
    });
  }
});
