import { describe, expect, it } from 'vitest';
import { buildCourse, isSolvable } from '../course/build';
import { sampleDistance } from '../course/fieldSample';
import { generateCourse } from '../course/generate';
import { NAV_LEVELS } from '../course/levels';
import { MOVER_SPEED_LIMIT, moverSweep, moverTopSpeed } from '../course/movers';
import { NAMED_COURSES } from '../course/presets';
import type { CourseSpec, Rect } from '../course/types';
import { generationCourses, nextLevel } from '../curriculum';
import { params } from './helpers';

function rectOf(o: CourseSpec['obstacles'][number]): Rect {
  return o.kind === 'mover' ? moverSweep(o) : o;
}

function insideRoom(spec: CourseSpec, r: Rect): boolean {
  return Math.abs(r.x) + r.hx <= spec.length / 2 + 1e-6 && Math.abs(r.z) + r.hz <= spec.width / 2 + 1e-6;
}

describe('generated courses', () => {
  for (const lv of NAV_LEVELS) {
    it(`level ${lv.level} (${lv.name}) is always solvable, tidy and new obstacles appear`, () => {
      const kinds = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) {
        const spec = generateCourse(lv.level, seed);
        expect(spec.level).toBe(lv.level);
        expect(spec.length).toBe(lv.length);
        const course = buildCourse(spec, params);
        expect(isSolvable(course)).toBe(true);
        for (const o of spec.obstacles) {
          kinds.add(o.kind);
          expect(insideRoom(spec, rectOf(o))).toBe(true);
          if (o.kind === 'mover') expect(moverTopSpeed(o)).toBeLessThanOrEqual(MOVER_SPEED_LIMIT + 1e-9);
        }
        if (lv.level > 0) expect(spec.obstacles.length).toBeGreaterThan(0);
        else expect(spec.obstacles.length).toBe(0);
      }
      const expected: Record<number, string[]> = { 1: ['block'], 2: ['block'], 3: ['spikes'], 4: ['wall'], 5: ['mover'], 6: ['block', 'spikes', 'wall', 'mover'] };
      for (const k of expected[lv.level] ?? []) expect(kinds.has(k)).toBe(true);
    });
  }

  it('are the same for the same seed and differ across seeds', () => {
    expect(generateCourse(6, 42)).toEqual(generateCourse(6, 42));
    expect(generateCourse(6, 42)).not.toEqual(generateCourse(6, 43));
  });

  it('keep movers clear of every static piece', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const level of [5, 6]) {
        const spec = generateCourse(level, seed);
        for (const m of spec.obstacles.filter((o) => o.kind === 'mover')) {
          const s = moverSweep(m);
          for (const o of spec.obstacles) {
            if (o === m || o.kind === 'mover') continue;
            const overlaps = Math.abs(s.x - o.x) < s.hx + o.hx - 1e-6 && Math.abs(s.z - o.z) < s.hz + o.hz - 1e-6;
            expect(overlaps).toBe(false);
          }
        }
      }
    }
  });
});

describe('named courses', () => {
  for (const spec of NAMED_COURSES) {
    it(`${spec.name} is solvable and its field runs from the start to the line`, () => {
      const course = buildCourse(spec, params);
      expect(isSolvable(course)).toBe(true);
      expect(sampleDistance(course.field, course.finishX + 0.5, 0)).toBe(0);
      expect(course.startDistance).toBeGreaterThan(course.finishX - course.startX - 0.5);
      for (const o of spec.obstacles) expect(insideRoom(spec, rectOf(o))).toBe(true);
    });
  }
  it('cover every level, with two held out for the benchmark', () => {
    expect(new Set(NAMED_COURSES.map((c) => c.level))).toEqual(new Set(NAV_LEVELS.map((l) => l.level)));
    expect(NAMED_COURSES.filter((c) => c.heldOut).length).toBe(2);
  });
});

describe('curriculum', () => {
  it('moves up once enough finish and never past the top', () => {
    expect(nextLevel(0, 0.59)).toBe(0);
    expect(nextLevel(0, 0.6)).toBe(1);
    expect(nextLevel(6, 1)).toBe(6);
  });
  it('gives every generation its own courses', () => {
    const a = generationCourses(3, 7, 1);
    const b = generationCourses(3, 7, 2);
    expect(a).toHaveLength(2);
    expect(a).toEqual(generationCourses(3, 7, 1));
    expect(a[0]).not.toEqual(b[0]);
    expect(a[0]).not.toEqual(a[1]);
  });
});
