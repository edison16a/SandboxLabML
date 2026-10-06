import { db, type LessonProgressRow } from './db';

/** Progress of one lesson: the step the learner is on and whether every step passed. */
export type LessonProgress = LessonProgressRow;

export function getLessonProgress(lessonId: string): Promise<LessonProgress | undefined> {
  return db().lessonProgress.get(lessonId);
}

/** Every lesson the learner has opened, keyed by lesson id, for the progress bars in the lesson list. */
export async function listLessonProgress(): Promise<Map<string, LessonProgress>> {
  const rows = await db().lessonProgress.toArray();
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Records where the learner is. The step only moves forward, so going back
 * to reread an earlier step never loses progress. Completion sticks too.
 */
export async function saveLessonProgress(lessonId: string, patch: { step?: number; completed?: boolean; source?: string }): Promise<LessonProgress> {
  const old = await getLessonProgress(lessonId);
  const row: LessonProgress = {
    id: lessonId,
    step: Math.max(old?.step ?? 0, patch.step ?? 0),
    completed: (old?.completed ?? false) || patch.completed === true,
    source: patch.source ?? old?.source ?? '',
    updatedAt: Date.now(),
  };
  await db().lessonProgress.put(row);
  return row;
}

/** Starts a lesson over from the first step. */
export async function resetLessonProgress(lessonId: string): Promise<void> {
  await db().lessonProgress.delete(lessonId);
}
