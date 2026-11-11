import { describe, expect, it } from 'vitest';
import { buildCourse, isSolvable } from '../course/build';
import { sampleDistance } from '../course/fieldSample';
import { generateCourse } from '../course/generate';
import { NAV_LEVELS } from '../course/levels';
import { MOVER_SPEED_LIMIT, moverSweep, moverTopSpeed } from '../course/movers';
import { NAMED_COURSES } from '../course/presets';
import { MIN_STUB } from '../course/sections';
import { MAX_MOVERS, type CourseSpec, type MoverSpec, type Rect } from '../course/types';
import { advanceCurriculum, eliteFinishShare, generationCourses, startCurriculum } from '../curriculum';
import { TOP_LEVEL } from '../course/levels';
import { navigationWorldSize, WORLD_HEADER } from '../snapshot';
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

  it('leave no short wall stubs and keep every number on the 5 cm grid', () => {
    const onGrid = (v: number) => Math.abs(v * 20 - Math.round(v * 20)) < 1e-6;
    const specs: CourseSpec[] = [...NAMED_COURSES];
    for (const level of [3, 4, 5, 6]) for (let seed = 1; seed <= 60; seed++) specs.push(generateCourse(level, seed));
    for (const spec of specs) {
      for (const o of spec.obstacles) {
        if (o.kind === 'wall') expect(o.hz * 2).toBeGreaterThanOrEqual(MIN_STUB - 1e-6);
        // Hand made courses may stop a mover a few cm from a wall; generated ones stay on the grid.
        if (!spec.id.startsWith('level-')) continue;
        const numbers = o.kind === 'mover' ? [o.ax, o.az, o.bx, o.bz, o.hx, o.hz] : [o.x, o.z, o.hx, o.hz];
        for (const v of numbers) expect(onGrid(v)).toBe(true);
      }
    }
  });

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

describe('building a course', () => {
  const slider = (z: number, period: number): MoverSpec => ({ kind: 'mover', hx: 0.5, hz: 0.5, height: 1, ax: 0, az: z - 2, bx: 0, bz: z + 2, period, phase: 0 });
  const spec = (obstacles: CourseSpec['obstacles']): CourseSpec => ({ id: 't', name: 'T', level: 5, length: 40, width: 14, obstacles });

  it('slows a mover that is too fast and keeps its path', () => {
    const course = buildCourse(spec([slider(0, 0.4), slider(0, 4), slider(0, 0), slider(0, Number.NaN)]), params);
    for (const m of course.movers) {
      expect(moverTopSpeed(m)).toBeLessThanOrEqual(MOVER_SPEED_LIMIT + 1e-9);
      expect(Number.isFinite(m.period) && m.period > 0).toBe(true);
      expect([m.az, m.bz]).toEqual([-2, 2]);
    }
    expect(course.movers[1].period).toBe(4);
  });

  it('runs at most MAX_MOVERS movers, so the world block always fits', () => {
    const many = Array.from({ length: MAX_MOVERS + 5 }, (_, k) => ({ ...slider(0, 4), ax: -15 + k * 2, bx: -15 + k * 2 }));
    const course = buildCourse(spec(many), params);
    expect(course.movers).toHaveLength(MAX_MOVERS);
    expect(navigationWorldSize()).toBeGreaterThanOrEqual(WORLD_HEADER + course.movers.length * 2);
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
  it('scores the best fifth of the population on the courses they finished', () => {
    const fitness = Array.from({ length: 10 }, (_, i) => i);
    // The two fittest (9 and 8) finished 2 and 1 of 2 courses; the rest do not count.
    const finished = [2, 2, 2, 2, 2, 2, 2, 2, 1, 2];
    expect(eliteFinishShare(fitness, finished, 2)).toBeCloseTo(0.75, 9);
    expect(eliteFinishShare([], [], 2)).toBe(0);
  });

  it('moves up after the minimum generations once the elite share holds, and never past the top', () => {
    let s = startCurriculum(0);
    s = advanceCurriculum(s, 1);
    s = advanceCurriculum(s, 1);
    expect(s.level).toBe(0);
    s = advanceCurriculum(s, 1);
    expect(s).toEqual({ level: 1, generations: 0, recent: [] });
    // One lucky generation is not enough: the last two are averaged.
    s = advanceCurriculum(advanceCurriculum(advanceCurriculum(s, 0.2), 0.3), 1);
    expect(s.level).toBe(1);
    s = advanceCurriculum(s, 0.9);
    expect(s.level).toBe(2);
    expect(advanceCurriculum({ level: TOP_LEVEL, generations: 9, recent: [1] }, 1).level).toBe(TOP_LEVEL);
    expect(advanceCurriculum({ level: 0, generations: 5, recent: [0.6] }, 0.6, 0.5).level).toBe(1);
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
