import type { CheckOutcome, LessonCheck } from './types';

export interface EvaluateOptions {
  /** Called between generations of a metricAbove check, so the UI can show progress and stay responsive. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Runs one lesson check against a script. Placeholder until the lessons
 * engine lands; it only reports that checks are unavailable.
 */
export async function evaluateCheck(_check: LessonCheck, _source: string, _opts: EvaluateOptions = {}): Promise<CheckOutcome> {
  return { passed: false, message: 'Lesson checks are not available yet.' };
}
