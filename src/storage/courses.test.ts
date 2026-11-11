import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { placeBlock } from '@/engine/navigation/course/edit';
import { emptyCourse } from '@/engine/navigation/course/sandbox';
import { deleteCourse, listCourses, newCourseId, saveCourse } from './courses';
import { SandboxDb, setDb } from './db';

let n = 0;
beforeEach(() => setDb(new SandboxDb(`courses-${n++}`)));

describe('Navigation courses in storage', () => {
  it('saves, lists in creation order, updates in place and deletes', async () => {
    const a = emptyCourse(newCourseId(), 'Hallway', 30);
    const b = placeBlock(emptyCourse(newCourseId(), 'Crates'), 2, 0, 'big').spec!;
    await saveCourse(a);
    await saveCourse(b);
    expect((await listCourses()).map((c) => c.name)).toEqual(['Hallway', 'Crates']);
    await saveCourse({ ...a, name: 'Long hall', length: 42 });
    const courses = await listCourses();
    expect(courses.map((c) => c.name)).toEqual(['Long hall', 'Crates']);
    expect(courses[0].length).toBe(42);
    expect(courses[1].obstacles).toEqual(b.obstacles);
    expect(courses[1].level).toBe(1);
    await deleteCourse(a.id);
    expect((await listCourses()).map((c) => c.id)).toEqual([b.id]);
  });

  it('skips a broken row instead of failing the list', async () => {
    await saveCourse(emptyCourse('course-ok', 'Fine'));
    await (await import('./db')).db().courses.put({ id: 'course-bad', spec: { obstacles: 'nope' }, createdAt: 1, updatedAt: 1 });
    expect((await listCourses()).map((c) => c.id)).toEqual(['course-ok']);
  });

  it('opens a version 4 database, keeps its data and adds the courses table', async () => {
    const name = `upgrade-${n++}`;
    const old = new Dexie(name);
    old.version(1).stores({ runs: 'id, env, updatedAt, deletedAt', settings: 'key' });
    old.version(2).stores({ hsGenerations: '[runId+generation], runId' });
    old.version(3).stores({ tracks: 'id, updatedAt' });
    old.version(4).stores({ sandboxRooms: 'id, createdAt' });
    await old.open();
    await old.table('settings').put({ key: 'k', value: 7 });
    await old.table('sandboxRooms').put({ id: 'r', room: {}, createdAt: 1, updatedAt: 1 });
    old.close();
    const next = new SandboxDb(name);
    setDb(next);
    expect((await next.settings.get('k'))?.value).toBe(7);
    expect(await next.sandboxRooms.count()).toBe(1);
    await saveCourse(emptyCourse('course-1', 'New'));
    expect(await listCourses()).toHaveLength(1);
  });
});
