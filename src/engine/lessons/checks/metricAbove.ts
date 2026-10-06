import type { PreparedScript } from '../prepare';
import { trainLessonScript, TRAINING_METRICS, type TrainingMetrics, type TrainingOptions } from '../training';
import type { CheckOutcome, LessonCheck } from '../types';
import { metricOutcome } from './compare';

type MetricCheck = Extract<LessonCheck, { kind: 'metricAbove' }>;

/** More than this and a check would keep a learner waiting too long. */
export const MAX_CHECK_GENERATIONS = 30;

/** Trains for the check's generations, then compares the metric with the target. */
export async function metricAboveCheck(check: MetricCheck, prepared: PreparedScript, opts: TrainingOptions): Promise<CheckOutcome> {
  if (!prepared.blueprint) return { passed: false, message: 'Training checks need a racing brain, such as brain racing-starter.' };
  if (!(TRAINING_METRICS as readonly string[]).includes(check.metric)) {
    return { passed: false, message: `Training cannot measure ${check.metric}. It measures ${TRAINING_METRICS.join(', ')}.` };
  }
  const generations = Math.max(1, Math.min(MAX_CHECK_GENERATIONS, Math.round(check.generations)));
  const metrics = await trainLessonScript(prepared, generations, opts);
  if (!metrics) return { passed: false, message: 'The check was stopped before training finished.' };
  const measured = metrics[check.metric as keyof TrainingMetrics];
  const what = `After ${generations} ${generations === 1 ? 'generation' : 'generations'} of training`;
  return metricOutcome(check.metric, measured, '>', check.value, check.message, what);
}
