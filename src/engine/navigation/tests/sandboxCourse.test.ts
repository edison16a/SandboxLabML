import { describe, expect, it } from 'vitest';
import { buildCourse, isSolvable } from '../course/build';
import { addMover, addSpikes, addWall, eraseAt, moveObstacle, obstacleAt, placeBlock, setLength, setLine, type EditResult } from '../course/edit';
import { courseLines } from '../course/lines';
import { NAMED_COURSES } from '../course/presets';
import { COURSE_LIMITS, courseLevel, emptyCourse, sanitizeCourse } from '../course/sandbox';
import type { CourseSpec } from '../course/types';
import { NavigationEnv } from '../env';
import { IDLE_BRAIN, navigatorController } from '../navigator/navigator';
import { STANDARD_NAVIGATION_INPUTS } from '../sensors/inputConfig';
import { params } from './helpers';

const ok = (r: EditResult): CourseSpec => {
  if (!r.spec) throw new Error(r.error);
  return r.spec;
};

describe('the Sandbox course editor rules', () => {
  const room = emptyCourse('c1', 'Mine', 36);

  it('starts from a room with the standard lines', () => {
    expect(courseLines(room)).toEqual(courseLines({ length: 36 }));
    expect(courseLevel(room)).toBe(0);
  });

  it('places crates, walls, spikes and movers on the grid, and reads the level from them', () => {
    let s = ok(placeBlock(room, 0.2, 1.3, 'long', true));
    expect(s.obstacles[0]).toMatchObject({ kind: 'block', x: 0, z: 1.5, hx: 1.1, hz: 0.5 });
    expect(s.level).toBe(1);
    s = ok(addWall(s, [4, -7], [4.2, 3]));
    expect(s.obstacles[1]).toMatchObject({ kind: 'wall', x: 4, z: -2, hz: 5 });
    s = ok(addSpikes(s, [8, -2], [9, 2]));
    expect(s.obstacles[2]).toMatchObject({ kind: 'spikes', x: 8.5, z: 0, hx: 0.5, hz: 2 });
    s = ok(addMover(s, [12, -4], [12, 4], 'medium'));
    expect(s.obstacles[3]).toMatchObject({ kind: 'mover', ax: 12, bx: 12, az: -4, bz: 4 });
    expect(s.level).toBe(6);
  });

  it('refuses pieces in the start zone, outside the room or past the limits', () => {
    const start = courseLines(room).start;
    expect(placeBlock(room, start - 1, 0, 'small').error).toMatch(/start zone/);
    expect(placeBlock(room, 0, 6.8, 'big').error).toMatch(/outside/);
    expect(addWall(room, [2, 0], [2.1, 0.1]).error).toMatch(/further/);
    let s = room;
    for (let i = 0; i < COURSE_LIMITS.movers; i++) s = ok(addMover(s, [-6 + i * 1.5, -3], [-6 + i * 1.5, 3], 'slow'));
    expect(addMover(s, [14, -3], [14, 3], 'slow').error).toMatch(/movers/);
  });

  it('finds, moves and erases the piece under a point', () => {
    const s = ok(placeBlock(room, 2, 2, 'small'));
    expect(obstacleAt(s, 2.3, 2.3)).toBe(0);
    expect(obstacleAt(s, 5, 5)).toBe(-1);
    expect(ok(moveObstacle(s, 0, 1, -0.5)).obstacles[0]).toMatchObject({ x: 3, z: 1.5 });
    expect(eraseAt(s, 2, 2)?.obstacles).toEqual([]);
    expect(eraseAt(s, 6, 6)).toBeNull();
  });

  it('moves the lines within their limits and keeps the start zone clear', () => {
    const s = ok(setLine(room, 'finish', 30));
    expect(s.finish).toBe(courseLines({ length: 36, finish: 99 }).finish);
    const blocked = ok(placeBlock(room, -6, 0, 'small'));
    expect(setLine(blocked, 'start', -4).error).toMatch(/Clear the floor/);
    expect(ok(setLine(room, 'start', -4)).start).toBe(-4);
  });

  it('resizes the room, keeping pieces by the start and dropping those that no longer fit', () => {
    const s = ok(placeBlock(ok(placeBlock(room, -6, 0, 'small')), 12, 0, 'small'));
    const short = setLength(s, 30);
    expect(short.obstacles).toHaveLength(1);
    expect(short.obstacles[0]).toMatchObject({ x: -3 });
    expect(courseLines(short).finish).toBe(courseLines({ length: 30 }).finish);
  });

  it('cleans stored courses and skips what is not one', () => {
    expect(sanitizeCourse(null)).toBeNull();
    expect(sanitizeCourse({ id: '', obstacles: [] })).toBeNull();
    const clean = sanitizeCourse({ id: 'x', name: '  ', length: 999, obstacles: [{ kind: 'block', x: 1e9, z: 0, hx: 0.5, hz: 0.5 }, { kind: 'laser' }, { kind: 'mover', hx: 0.6, hz: 0.8, ax: 0, az: -9, bx: 0, bz: 9, period: -1 }] });
    expect(clean?.name).toBe('My course');
    expect(clean?.length).toBe(50);
    expect(clean?.obstacles).toHaveLength(2);
    expect(clean?.obstacles[1]).toMatchObject({ kind: 'mover', az: -6.2, bz: 6.2, period: 1 });
    for (const named of NAMED_COURSES) expect(sanitizeCourse(named)?.obstacles).toEqual(named.obstacles);
  });

  it('builds a drawn course the navigator finishes from a moved start', () => {
    let s = ok(setLine(room, 'start', -6));
    s = ok(addWall(s, [0, -7], [0, 3]));
    s = ok(addSpikes(s, [6, 1], [7, 7]));
    const course = buildCourse(s, params);
    expect(isSolvable(course)).toBe(true);
    expect(course.startX).toBe(-6);
    const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: navigatorController(course, params) });
    env.reset([IDLE_BRAIN, IDLE_BRAIN], [1, 2], [0, 7]);
    while (!env.done) env.step();
    expect(env.results().map((r) => r.stopReason)).toEqual(['finished', 'finished']);
    expect(env.agents.every((a) => a.slot >= 0)).toBe(true);
  });
});
