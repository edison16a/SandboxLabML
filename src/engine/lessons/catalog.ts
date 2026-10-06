import type { EnvId } from '../env/types';
import type { Lesson } from './types';

/**
 * Every lesson, in course order. Content lives in content/lessons/<course>/
 * as JSON and is imported statically so the bundler ships it with Studio.
 */
export const LESSONS: Lesson[] = [];

export function lessonsFor(course: EnvId): Lesson[] {
  return LESSONS.filter((l) => l.course === course).sort((a, b) => a.order - b.order);
}

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
