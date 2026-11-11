import { describe, expect, it } from 'vitest';
import { addMover, addWall, type EditResult } from '../course/edit';
import { generateCourse } from '../course/generate';
import { NAMED_COURSES } from '../course/presets';
import { emptyCourse } from '../course/sandbox';
import type { CourseSpec, MoverSpec, WallSpec } from '../course/types';
import { moverCore, noWayThrough } from '../navigator/wayThrough';

const ok = (r: EditResult): CourseSpec => {
  if (!r.spec) throw new Error(r.error);
  return r.spec;
};

const wall = (x: number, z0: number, z1: number): WallSpec => ({ kind: 'wall', x, z: (z0 + z1) / 2, hx: 0.15, hz: (z1 - z0) / 2 });
const mover = (m: Partial<MoverSpec>): MoverSpec => ({ kind: 'mover', hx: 0.6, hz: 0.8, height: 1, ax: 0, az: 0, bx: 0, bz: 0, period: 4.2, phase: 0, ...m });

describe('the way through check', () => {
  it('finds the floor a short mover never leaves', () => {
    const core = moverCore(mover({ ax: 2, bx: 2, az: 0.5, bz: 1.5 }))!;
    expect([core.x, core.z, core.hx, core.hz].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([2, 1, 0.6, 0.3]);
    expect(moverCore(mover({ ax: 2, bx: 2, az: -3, bz: 3 }))).toBeNull();
  });

  it('refuses a mover that always closes the only gap (the review layout)', () => {
    // A wall across a 30 m room at x = 2 with a 1.5 m gap, and a slow mover with a 1 m path in it.
    const spec: CourseSpec = { ...emptyCourse('mb', 'mb', 30), obstacles: [wall(2, -7, 0), wall(2, 1.5, 7), mover({ ax: 2, bx: 2, az: 0.5, bz: 1.5 })] };
    expect(noWayThrough(spec)).toBe('movers');
    // The editor itself no longer takes that mover: it would slide into the wall.
    const walls = ok(addWall(ok(addWall(emptyCourse('mb', 'mb', 30), [2, -7], [2, 0])), [2, 1.5], [2, 7]));
    expect(addMover(walls, [2, 0.25], [2, 1.25], 'slow').error).toMatch(/slide into/);
  });

  it('refuses a long mover in a lane it fills, which no moment leaves open', () => {
    // A 2 m lane along the room, closed off at its sides, with a crate sliding up and down all of it.
    const spec: CourseSpec = {
      ...emptyCourse('lane', 'lane', 36),
      obstacles: [wall(-2, -7, -1), wall(-2, 1, 7), wall(6, -7, -1), wall(6, 1, 7), { kind: 'wall', x: 2, z: -1.15, hx: 4, hz: 0.15 }, { kind: 'wall', x: 2, z: 1.15, hx: 4, hz: 0.15 }, mover({ hx: 0.8, hz: 0.9, ax: -1, bx: 5, az: 0, bz: 0 })],
    };
    expect(moverCore(spec.obstacles[6] as MoverSpec)).toBeNull();
    expect(noWayThrough(spec)).toBe('movers');
  });

  it('passes every named course and generated mover levels, and says when walls close the room', () => {
    for (const c of NAMED_COURSES) expect(noWayThrough(c), c.id).toBeNull();
    for (const level of [5, 6]) for (let seed = 1; seed <= 3; seed++) expect(noWayThrough(generateCourse(level, seed)), `${level}/${seed}`).toBeNull();
    const closed = ok(addWall(emptyCourse('c', 'c', 30), [0, -7], [0, 7]));
    expect(noWayThrough(closed)).toBe('blocked');
    expect(noWayThrough(ok(addMover(emptyCourse('o', 'o', 30), [4, -4], [4, 4], 'fast')))).toBeNull();
  });
});
