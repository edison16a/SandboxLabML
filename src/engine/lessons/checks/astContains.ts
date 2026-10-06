import { matchesAny } from '../astMatch';
import type { PreparedScript } from '../prepare';
import type { CheckOutcome, LessonCheck } from '../types';

type AstCheck = Extract<LessonCheck, { kind: 'astContains' }>;

/** Passes when the script contains a statement matching any of the check's patterns. */
export function astContainsCheck(check: AstCheck, prepared: PreparedScript): CheckOutcome {
  return matchesAny(prepared.compiled.program, check.anyOf)
    ? { passed: true, message: 'Passed. Found it in your script.' }
    : { passed: false, message: check.message };
}
