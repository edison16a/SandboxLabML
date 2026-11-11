import type { ContentStep } from '../../env/episode';
import type { RunConfig } from '../../training/runConfig';
import { advanceCurriculum, ELITE_BAR, eliteFinishShare, startCurriculum, type CurriculumState } from '../curriculum';
import { namedCourse, trainingCourse } from '../course/presets';
import type { NavigationRunResult } from './runResult';
import { clampCourses, clampLevel, navigationOf } from './settings';

/**
 * What a Navigation population trains on right now. Small plain JSON, kept
 * on every record (contentOnRecords), so a branch resumes on it and a
 * champion can replay on its own courses: the generation picks the course
 * seeds, the curriculum the level.
 */
export interface NavigationContent {
  /** The generation these courses are for: generated courses are seeded by the run seed and this. */
  generation: number;
  curriculum: CurriculumState;
  /** Climb levels on its own (the run's setting); a script's autoLevel works either way. */
  auto: boolean;
  /** A named course every brain runs, or null for generated courses. */
  course: string | null;
  /** Generated courses per generation. A named course runs once. */
  courses: number;
}

/**
 * The keys a script's generation block sets with setEnvDirective, read
 * here once the block has run: a level, a named course (or "random" for
 * generated ones), a course count, and the bar of a one off autoLevel.
 */
export const NAV_DIRECTIVE = { level: 'level', course: 'course', courses: 'courses', autoLevel: 'autoLevel' } as const;

/** Generated course ids are "level-<n>-<seed>"; a script asks for them back with this. */
export const RANDOM_COURSE = 'random';

export function initialNavigationContent(config: RunConfig): NavigationContent {
  const { settings } = navigationOf(config);
  return { generation: 0, curriculum: startCurriculum(settings.startLevel), auto: settings.autoLevel, course: settings.course, courses: settings.coursesPerGeneration };
}

/** The level the content trains on: a named course's own, else the curriculum's. */
export function contentLevel(content: NavigationContent): number {
  return content.course ? (namedCourse(content.course)?.level ?? content.curriculum.level) : content.curriculum.level;
}

/** Courses each brain runs on this content. */
export function contentCourses(content: NavigationContent): number {
  return content.course ? 1 : content.courses;
}

/** The share of the generation's courses its best fifth finished: the curriculum's signal. */
export function eliteShareOf(results: readonly NavigationRunResult[]): number {
  const courses = results[0]?.courses ?? 1;
  return eliteFinishShare(
    results.map((r) => r.fitness),
    results.map((r) => r.finished),
    courses,
  );
}

/**
 * The content of the next generation. The curriculum moves first (on its
 * own when the run climbs automatically, or once when the script called
 * autoLevel with its own bar), then the script's requests win: a level
 * restarts the curriculum there, a course or a course count replaces the
 * old one. A new level or course resets stagnation, since its scores do
 * not compare with the old ones. Named courses never climb.
 */
export function nextNavigationContent(step: ContentStep<NavigationContent, NavigationRunResult>): { content: NavigationContent; reset: boolean } {
  const { content, directives, results } = step;
  const asked = directives.env ?? {};
  let curriculum = content.curriculum;
  const bar = asked[NAV_DIRECTIVE.autoLevel];
  if (!content.course && (content.auto || typeof bar === 'number')) {
    curriculum = advanceCurriculum(curriculum, eliteShareOf(results), typeof bar === 'number' ? bar : ELITE_BAR);
  }
  const level = asked[NAV_DIRECTIVE.level];
  if (typeof level === 'number' && clampLevel(level) !== curriculum.level) curriculum = startCurriculum(clampLevel(level));
  let course = content.course;
  const wanted = asked[NAV_DIRECTIVE.course];
  if (wanted === RANDOM_COURSE) course = null;
  // The benchmark's held out rooms are refused, so no script can train on them.
  else if (typeof wanted === 'string' && trainingCourse(wanted)) course = wanted;
  const count = asked[NAV_DIRECTIVE.courses];
  const courses = typeof count === 'number' ? clampCourses(count) : content.courses;
  const next: NavigationContent = { generation: step.generation + 1, curriculum, auto: content.auto, course, courses };
  return { content: next, reset: contentLevel(next) !== contentLevel(content) || course !== content.course };
}

/** Stored as each record's trackHash: what the generation ran on, in a few characters. */
export function navigationContentHash(content: NavigationContent): string {
  return content.course ? `course:${content.course}` : `level-${content.curriculum.level}:gen-${content.generation}:x${content.courses}`;
}
