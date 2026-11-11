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

/** Runs perfect navigators from the given start slots and returns their results. */
function walk(spec: CourseSpec, slots: number[]) {
  const course = buildCourse(spec, params);
  const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: navigatorController(course, params) });
  env.reset(
    slots.map(() => IDLE_BRAIN),
    slots.map((s) => 500 + s * 31),
    slots,
  );
  while (!env.done) env.step();
  return env.results();
}

/** Front, middle, back and the far sides of a 100 agent grid. */
const SPREAD = [0, 16, 45, 83, 99];

describe('scripted navigator', () => {
  for (const spec of NAMED_COURSES) {
    it(`finishes ${spec.name} from every part of the grid`, () => {
      for (const r of walk(spec, SPREAD)) {
        expect(r.stopReason).toBe('finished');
        expect(r.fitness).toBeGreaterThan(19);
      }
    });
  }

  // Movers are where timing goes wrong, so those levels get the most courses.
  const counts: Record<number, number> = { 5: 120, 6: 120 };
  for (const lv of NAV_LEVELS) {
    const count = counts[lv.level] ?? 30;
    it(`finishes ${count} generated level ${lv.level} courses without dying`, () => {
      const failures: string[] = [];
      for (let seed = 1000; seed < 1000 + count; seed++) {
        const slots = [SPREAD[seed % 5], SPREAD[(seed + 2) % 5]];
        walk(generateCourse(lv.level, seed), slots).forEach((r, k) => {
          if (r.stopReason !== 'finished') failures.push(`seed ${seed} slot ${slots[k]}: ${r.stopReason}`);
        });
      }
      expect(failures).toEqual([]);
    });
  }
});
