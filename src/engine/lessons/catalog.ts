import driving01 from '@content/lessons/driving/01-first-trip.json';
import driving02 from '@content/lessons/driving/02-arrive.json';
import driving03 from '@content/lessons/driving/03-red-lights.json';
import driving04 from '@content/lessons/driving/04-senses.json';
import driving05 from '@content/lessons/driving/05-curriculum.json';
import driving06 from '@content/lessons/driving/06-debug.json';
import driving07 from '@content/lessons/driving/07-built-in-reward.json';
import hideseek01 from '@content/lessons/hideseek/01-points-for-hiding.json';
import hideseek02 from '@content/lessons/hideseek/02-seeker-goal.json';
import hideseek03 from '@content/lessons/hideseek/03-boxes.json';
import hideseek04 from '@content/lessons/hideseek/04-hall-of-fame.json';
import hideseek05 from '@content/lessons/hideseek/05-shape-rewards.json';
import hideseek06 from '@content/lessons/hideseek/06-debug.json';
import navigation01 from '@content/lessons/navigation/01-first-run.json';
import navigation02 from '@content/lessons/navigation/02-reward-what-you-want.json';
import navigation03 from '@content/lessons/navigation/03-spikes-and-stop-rules.json';
import navigation04 from '@content/lessons/navigation/04-what-the-brain-senses.json';
import navigation05 from '@content/lessons/navigation/05-steer-the-curriculum.json';
import navigation06 from '@content/lessons/navigation/06-the-built-in-reward.json';
import lesson01 from '@content/lessons/racing/01-drive-straight.json';
import lesson02 from '@content/lessons/racing/02-reward-progress.json';
import lesson03 from '@content/lessons/racing/03-see-the-road.json';
import lesson04 from '@content/lessons/racing/04-brake-for-corners.json';
import lesson05 from '@content/lessons/racing/05-tune-evolution.json';
import lesson06 from '@content/lessons/racing/06-read-the-charts.json';
import lesson07 from '@content/lessons/racing/07-base-script.json';
import type { EnvId } from '../env/types';
import type { Lesson } from './types';

const RACING = [lesson01, lesson02, lesson03, lesson04, lesson05, lesson06, lesson07];
const HIDESEEK = [hideseek01, hideseek02, hideseek03, hideseek04, hideseek05, hideseek06];
const DRIVING = [driving01, driving02, driving03, driving04, driving05, driving06, driving07];
const NAVIGATION = [navigation01, navigation02, navigation03, navigation04, navigation05, navigation06];

/**
 * Every lesson, in course order. Content lives in content/lessons/<course>/
 * as JSON and is imported statically so the bundler ships it with Studio.
 * JSON imports are typed loosely (strings where the contract has unions),
 * so they are cast here and checked by validateLesson in the tests.
 */
export const LESSONS: Lesson[] = [...RACING, ...HIDESEEK, ...DRIVING, ...NAVIGATION] as Lesson[];

export function lessonsFor(course: EnvId): Lesson[] {
  return LESSONS.filter((l) => l.course === course).sort((a, b) => a.order - b.order);
}

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
