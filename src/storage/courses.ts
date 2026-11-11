import { sanitizeCourse } from '@/engine/navigation/course/sandbox';
import type { CourseSpec } from '@/engine/navigation/course/types';
import { newRunId } from '@/engine/training/runConfig';
import { db } from './db';

/** Ids of drawn courses start with this, so they never clash with a named or generated course id. */
export const COURSE_ID_PREFIX = 'course-';

/** A fresh id for a course the user starts drawing. */
export function newCourseId(): string {
  return `${COURSE_ID_PREFIX}${newRunId()}`;
}

/** The user's own Navigation courses, oldest first so the picker keeps them in place. Broken rows are skipped. */
export async function listCourses(): Promise<CourseSpec[]> {
  const rows = await db().courses.orderBy('createdAt').toArray();
  return rows.map((r) => sanitizeCourse({ ...(r.spec as object), id: r.id })).filter((c): c is CourseSpec => c !== null);
}

/** Saves a course, keeping when it was first made. Returns the course as stored, cleaned. */
export async function saveCourse(spec: CourseSpec): Promise<CourseSpec> {
  const clean = sanitizeCourse(spec);
  if (!clean) throw new Error('That is not a course that can be saved.');
  const now = Date.now();
  const d = db();
  await d.transaction('rw', d.courses, async () => {
    const old = await d.courses.get(clean.id);
    await d.courses.put({ id: clean.id, spec: clean, createdAt: old?.createdAt ?? now, updatedAt: now });
  });
  return clean;
}

export async function deleteCourse(id: string): Promise<void> {
  await db().courses.delete(id);
}
