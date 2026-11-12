import { astContainsCheck } from './checks/astContains';
import { compilesCheck } from './checks/compiles';
import { metricAboveCheck } from './checks/metricAbove';
import { testRunCheck } from './checks/testRun';
import { episodeMetricCheck, episodeTestRunCheck } from './episode/checks';
import { prepareScript } from './prepare';
import type { CheckOutcome, LessonCheck } from './types';

export interface EvaluateOptions {
  /** Called as a check plays or trains, so the UI can show progress and stay responsive. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Runs one lesson check against a script. Every check needs the script to
 * compile first, so a learner always hears about the first error before
 * anything else. Never throws: problems come back as a failed outcome with
 * a message meant for the learner. Racing test drives and training run on
 * the track the script picks with useTrack, or the Oval.
 */
export async function evaluateCheck(check: LessonCheck, source: string, opts: EvaluateOptions = {}): Promise<CheckOutcome> {
  try {
    const prepared = prepareScript(source);
    if (!prepared.ok) return { passed: false, message: prepared.message };
    const p = prepared.value;
    switch (check.kind) {
      case 'compiles':
        return compilesCheck(check, p);
      case 'astContains':
        return astContainsCheck(check, p);
      case 'testRun':
        if (p.env === 'racing') return testRunCheck(check, p);
        return await episodeTestRunCheck(check, p);
      case 'metricAbove':
        if (p.env === 'racing') return await metricAboveCheck(check, p, opts);
        return await episodeMetricCheck(check, p, opts);
      default:
        return { passed: false, message: 'This step has a check this version of the app does not know.' };
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { passed: false, message: `The check could not run: ${reason}` };
  }
}
