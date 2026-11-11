import { requireEpisodeInfo } from '../../env/registry';
import { MAX_CHECK_GENERATIONS } from '../checks/metricAbove';
import { metricOutcome } from '../checks/compare';
import type { TrainingOptions } from '../training';
import type { CheckOutcome, LessonCheck } from '../types';
import { testRunMetricNames, trainingMetricNames } from './names';
import { testEpisode, trainEpisodeLesson, type PreparedEpisode, type PreparedWithBrain } from './run';

type TestRunCheck = Extract<LessonCheck, { kind: 'testRun' }>;
type MetricCheck = Extract<LessonCheck, { kind: 'metricAbove' }>;

/** "a test drive" as the start of an outcome: "Test drive". */
function heading(name: string): string {
  const bare = name.replace(/^(a|an|one)\s+/i, '');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

const hasBrain = (p: PreparedEpisode): p is PreparedWithBrain => p.blueprint !== null;

/** The env's lesson info. prepareScript only lets a script of an env with lessons through. */
function lessonInfo(env: string) {
  const info = requireEpisodeInfo(env);
  if (!info.lessons) throw new Error('This lab has no lessons yet.');
  return { label: info.label, lessons: info.lessons };
}

/** The failed outcome for a script without a brain of its env, naming one it could use. */
function needsBrain(p: PreparedEpisode, what: string): CheckOutcome {
  const { label, lessons } = lessonInfo(p.env);
  return { passed: false, message: `${what} need a ${label} brain, such as brain ${lessons.brain}.` };
}

/** Runs a testRun check for an env added through the registry. */
export async function episodeTestRunCheck(check: TestRunCheck, p: PreparedEpisode): Promise<CheckOutcome> {
  const { lessons } = lessonInfo(p.env);
  if (!hasBrain(p)) return needsBrain(p, 'Test runs');
  const names = testRunMetricNames(lessons);
  if (!names.includes(check.metric)) return { passed: false, message: `${heading(lessons.testRunName)} cannot measure ${check.metric}. It measures ${names.join(', ')}.` };
  const measured = (await testEpisode(p))[check.metric] ?? NaN;
  return metricOutcome(check.metric, measured, check.op, check.value, check.message, heading(lessons.testRunName), lessons.formats);
}

/** Trains for the check's generations, then compares the metric with the target. */
export async function episodeMetricCheck(check: MetricCheck, p: PreparedEpisode, opts: TrainingOptions): Promise<CheckOutcome> {
  if (!hasBrain(p)) return needsBrain(p, 'Training checks');
  const names = trainingMetricNames(p.env);
  if (!names.includes(check.metric)) return { passed: false, message: `Training cannot measure ${check.metric}. It measures ${names.join(', ')}.` };
  const generations = Math.max(1, Math.min(MAX_CHECK_GENERATIONS, Math.round(check.generations)));
  const metrics = await trainEpisodeLesson(p, generations, opts);
  if (!metrics) return { passed: false, message: 'The check was stopped before training finished.' };
  const what = `After ${generations} ${generations === 1 ? 'generation' : 'generations'} of training`;
  return metricOutcome(check.metric, metrics[check.metric] ?? NaN, '>', check.value, check.message, what, lessonInfo(p.env).lessons.formats);
}
