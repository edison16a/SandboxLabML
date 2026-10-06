import lesson01 from '@content/lessons/racing/01-drive-straight.json';
import lesson02 from '@content/lessons/racing/02-reward-progress.json';
import lesson03 from '@content/lessons/racing/03-see-the-road.json';
import lesson04 from '@content/lessons/racing/04-brake-for-corners.json';
import lesson05 from '@content/lessons/racing/05-tune-evolution.json';
import lesson06 from '@content/lessons/racing/06-read-the-charts.json';
import lesson07 from '@content/lessons/racing/07-base-script.json';
import type { EnvId } from '../env/types';
import type { Lesson } from './types';

/**
 * Every lesson, in course order. Content lives in content/lessons/<course>/
 * as JSON and is imported statically so the bundler ships it with Studio.
 * JSON imports are typed loosely (strings where the contract has unions),
 * so they are cast here and checked by validateLesson in the tests.
 */
export const LESSONS: Lesson[] = [lesson01, lesson02, lesson03, lesson04, lesson05, lesson06, lesson07] as Lesson[];

export function lessonsFor(course: EnvId): Lesson[] {
  return LESSONS.filter((l) => l.course === course).sort((a, b) => a.order - b.order);
}

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
