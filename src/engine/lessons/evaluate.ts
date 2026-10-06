import { astContainsCheck } from './checks/astContains';
import { compilesCheck } from './checks/compiles';
import { metricAboveCheck } from './checks/metricAbove';
import { testRunCheck } from './checks/testRun';
import { prepareScript } from './prepare';
import type { CheckOutcome, LessonCheck } from './types';

export interface EvaluateOptions {
  /** Called as a check plays or trains, so the UI can show progress and stay responsive. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * The Hide and Seek checks bring in the Rapier physics engine, a few
 * megabytes of WASM, so they load the first time a Hide and Seek lesson
 * plays a match instead of with the Learn tab.
 */
const hideSeekChecks = () => import('./hideseek/checks');

/**
 * Runs one lesson check against a script. Every check needs the script to
 * compile first, so a learner always hears about the first error before
 * anything else. Never throws: problems come back as a failed outcome with
 * a message meant for the learner. Racing test drives and training run on
 * the track the script picks with useTrack, or the Oval. Hide and Seek test
 * matches play in the first room the script picks with useLayout, or the
 * open room.
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
        return await (await hideSeekChecks()).hideSeekTestRunCheck(check, p, opts.signal);
      case 'metricAbove':
        if (p.env === 'racing') return await metricAboveCheck(check, p, opts);
        return await (await hideSeekChecks()).hideSeekMetricCheck(check, p, opts);
      default:
        return { passed: false, message: 'This step has a check this version of the app does not know.' };
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { passed: false, message: `The check could not run: ${reason}` };
  }
}
