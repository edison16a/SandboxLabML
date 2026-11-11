import { NAV_DIRECTIVE, RANDOM_COURSE } from '../../../navigation/pipeline/content';
import { NAV_METRIC } from '../../../navigation/pipeline/metricSpecs';
import { MAX_COURSES, MIN_COURSES } from '../../../navigation/pipeline/settings';
import { TRAINING_COURSES } from '../../../navigation/course/presets';
import { TOP_LEVEL } from '../../../navigation/course/levels';
import { clampTo, entry, param, req } from '../define';
import { metricSensor, setEnvDirective } from '../envHelpers';
import type { TickIO } from '../../../env/types';
import type { EffectArgs, Reader, RegistryEntry } from '../types';
import { ADVANCED } from './sensor';

/** An operator of the each generation block that sets one Navigation request. */
function operator(d: Omit<Parameters<typeof entry>[0], 'kind' | 'scope' | 'env' | 'type' | 'unit' | 'binding'>, key: string, value: (args: EffectArgs) => (v: unknown, io: TickIO) => unknown): RegistryEntry {
  return entry({
    ...d,
    kind: 'operator',
    scope: 'generation',
    env: 'navigation',
    type: 'void',
    unit: '',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const read = value(args);
        return (v, io) => setEnvDirective(v, key, read(v, io));
      },
    },
  });
}

/** A whole number argument, clamped into its range. */
const numberOf = (r: Reader, lo: number, hi: number) => (v: unknown, io: TickIO) => Math.round(clampTo(r(v, io), lo, hi));

/**
 * What the each generation block can read about the courses and the
 * requests it can make: a level, a named course, a course count, or a
 * level up rule of its own. The env checks every value again before it
 * applies it, so a script can steer the curriculum but never break it.
 */
export const NAVIGATION_GENERATION_ENTRIES: RegistryEntry[] = [
  metricSensor({ name: 'course.level', env: 'navigation', key: NAV_METRIC.level, unit: '', label: 'level', presets: ADVANCED, summary: 'The level the last generation ran on, from 0 to 6.', description: 'With the automatic curriculum on it climbs by itself as the best runners master each level. Compare it with a number to change rewards or rules as the courses get harder.', example: 'if course.level < 2 {\n  coursesPerGeneration(count: 1)\n}', explain: 'the level', range: [0, TOP_LEVEL] }),
  metricSensor({ name: 'course.finished', env: 'navigation', key: NAV_METRIC.finishShare, unit: '', label: 'share finished', summary: 'Share of all runs in the last generation that crossed the line.', description: 'Every brain runs every course, and this counts each run. Mutated brains always trip, so it stays below course.bestFinished on hard levels.', example: 'if course.finished > 0.6 {\n  useLevel(level: course.level + 1)\n}', explain: 'the share that finished', range: [0, 1] }),
  metricSensor({ name: 'course.bestFinished', env: 'navigation', key: NAV_METRIC.eliteShare, unit: '', label: 'share the best fifth finished', summary: 'Share of its courses the best fifth of the population finished.', description: 'The automatic curriculum climbs on this number, since the best brains are the ones that breed. It is 1 when every one of them finished every course.', example: 'if course.bestFinished > 0.9 {\n  coursesPerGeneration(count: 3)\n}', explain: 'the share the best fifth finished', range: [0, 1] }),
  metricSensor({ name: 'course.died', env: 'navigation', key: NAV_METRIC.deathShare, unit: '', label: 'share died', summary: 'Share of all runs in the last generation that ended on spikes or under a mover.', description: 'High when a level with hazards is new. Watch it fall as the population learns to keep clear.', example: 'if course.died > 0.5 {\n  useLevel(level: course.level - 1)\n}', explain: 'the share that died', range: [0, 1] }),
  operator(
    {
      name: 'useLevel',
      params: [param('level', 'number', '', 'The level from 0 (straight run) to 6 (gauntlet).', { range: [0, TOP_LEVEL] })],
      summary: 'Trains the next generation on fresh courses of this level.',
      description: 'The automatic curriculum carries on from the new level, if it is on. Calling it every generation pins the level, and calling it once moves the curriculum there.',
      example: 'if generation == 0 {\n  useLevel(level: 2)\n}',
      block: { category: 'environment', label: 'use level {level}' },
      explain: 'train on level {level}',
    },
    NAV_DIRECTIVE.level,
    ({ num }) => numberOf(req(num, 'level'), 0, TOP_LEVEL),
  ),
  operator(
    {
      name: 'useCourse',
      params: [param('id', 'string', '', 'A named course, or "random" for fresh courses of the level.', { choices: [...TRAINING_COURSES.map((c) => c.id), RANDOM_COURSE] })],
      summary: 'Trains the next generation on one named course.',
      description: 'Every brain runs the same hand made course until the script picks another. One fixed course trains fast but teaches the room, not navigation, so "random" goes back to fresh courses.',
      example: 'useCourse(id: "zigzag")',
      block: { category: 'environment', label: 'use course {id}' },
      explain: 'train on the {id} course',
    },
    NAV_DIRECTIVE.course,
    ({ str }) => {
      const id = req(str, 'id');
      return () => id;
    },
  ),
  operator(
    {
      name: 'coursesPerGeneration',
      presets: ADVANCED,
      params: [param('count', 'number', '', `How many courses each brain runs, ${MIN_COURSES} to ${MAX_COURSES}.`, { range: [MIN_COURSES, MAX_COURSES] })],
      summary: 'Sets how many fresh courses each brain runs per generation.',
      description: 'Each brain scores its average over the courses. More courses judge a brain more fairly, so a lucky room decides less, but a generation takes longer.',
      example: 'coursesPerGeneration(count: 3)',
      block: { category: 'environment', label: 'run {count} courses' },
      explain: 'run {count} courses per generation',
    },
    NAV_DIRECTIVE.courses,
    ({ num }) => numberOf(req(num, 'count'), MIN_COURSES, MAX_COURSES),
  ),
  operator(
    {
      name: 'autoLevel',
      params: [param('threshold', 'number', '', 'Share of its courses the best fifth must finish, from 0.05 to 1.', { range: [0.05, 1] })],
      summary: 'Moves up a level once the best fifth finishes this share of its courses.',
      description: 'The share is averaged over the last two generations, and each level runs at least three. It works even when the run was made with a fixed level.',
      example: 'autoLevel(threshold: 0.6)',
      block: { category: 'environment', label: 'level up at {threshold}' },
      explain: 'level up once the best fifth finishes {threshold} of its courses',
    },
    NAV_DIRECTIVE.autoLevel,
    ({ num }) => {
      const share = req(num, 'threshold');
      return (v: unknown, io: TickIO) => clampTo(share(v, io), 0.05, 1);
    },
  ),
];
