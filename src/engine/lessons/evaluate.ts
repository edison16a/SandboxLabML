import { astContainsCheck } from './checks/astContains';
import { compilesCheck } from './checks/compiles';
import { metricAboveCheck } from './checks/metricAbove';
import { testRunCheck } from './checks/testRun';
import { prepareScript } from './prepare';
import type { CheckOutcome, LessonCheck } from './types';

export interface EvaluateOptions {
  /** Called between generations of a metricAbove check, so the UI can show progress and stay responsive. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const NOT_YET = 'Test drives and training checks for Hide and Seek are not available yet. Compile and structure checks work today.';

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
        return p.env === 'racing' ? testRunCheck(check, p) : { passed: false, message: NOT_YET };
      case 'metricAbove':
        return p.env === 'racing' ? await metricAboveCheck(check, p, opts) : { passed: false, message: NOT_YET };
      default:
        return { passed: false, message: 'This step has a check this version of the app does not know.' };
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { passed: false, message: `The check could not run: ${reason}` };
  }
}
