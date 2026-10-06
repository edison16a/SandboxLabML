import { metricOutcome } from '../checks/compare';
import type { PreparedHideSeek } from '../prepare';
import type { CheckOutcome, LessonCheck } from '../types';
import { HIDESEEK_TRAINING_METRICS, MAX_HIDESEEK_CHECK_GENERATIONS, TEST_MATCH_METRICS, type HideSeekTrainingMetric, type TestMatchMetric } from './metrics';
import { playTestMatch } from './testMatch';
import { trainHideSeekLesson, type HideSeekTrainingOptions } from './training';

type TestRunCheck = Extract<LessonCheck, { kind: 'testRun' }>;
type MetricCheck = Extract<LessonCheck, { kind: 'metricAbove' }>;

const NO_BRAIN = 'needs a Hide and Seek brain, such as brain hideseek-starter.';
const STOPPED = 'The check was stopped before it finished.';

/**
 * Hide and Seek checks that play matches. evaluate.ts loads this module
 * only when a Hide and Seek lesson asks for one, because it brings in the
 * physics engine. Unknown metrics fail with a message naming the ones that
 * exist, so a typo in lesson content is easy to fix.
 */
export async function hideSeekTestRunCheck(check: TestRunCheck, prepared: PreparedHideSeek, signal?: AbortSignal): Promise<CheckOutcome> {
  if (!prepared.blueprint) return { passed: false, message: `A test match ${NO_BRAIN}` };
  if (!(TEST_MATCH_METRICS as readonly string[]).includes(check.metric)) {
    return { passed: false, message: `A test match cannot measure ${check.metric}. It measures ${TEST_MATCH_METRICS.join(', ')}.` };
  }
  const metrics = await playTestMatch(prepared, signal);
  if (!metrics) return { passed: false, message: STOPPED };
  return metricOutcome(check.metric, metrics[check.metric as TestMatchMetric], check.op, check.value, check.message, 'Test match');
}

/** Trains both teams for the check's generations, then compares the metric with the target. */
export async function hideSeekMetricCheck(check: MetricCheck, prepared: PreparedHideSeek, opts: HideSeekTrainingOptions): Promise<CheckOutcome> {
  if (!prepared.blueprint) return { passed: false, message: `Training ${NO_BRAIN}` };
  if (!(HIDESEEK_TRAINING_METRICS as readonly string[]).includes(check.metric)) {
    return { passed: false, message: `Training cannot measure ${check.metric}. It measures ${HIDESEEK_TRAINING_METRICS.join(', ')}.` };
  }
  const generations = Math.max(1, Math.min(MAX_HIDESEEK_CHECK_GENERATIONS, Math.round(check.generations)));
  const metrics = await trainHideSeekLesson(prepared, generations, opts);
  if (!metrics) return { passed: false, message: STOPPED };
  const what = `After ${generations} ${generations === 1 ? 'generation' : 'generations'} of training`;
  return metricOutcome(check.metric, metrics[check.metric as HideSeekTrainingMetric], '>', check.value, check.message, what);
}
