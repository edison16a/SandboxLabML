import type { EnvId } from '@/engine/env/types';
import { DEFAULT_SCRIPT_ENV } from '@/engine/script';
import { isLabEnv } from '@/features/shell/labs';

/** The script a newcomer opens on: the Driving Beginner preset. */
export const STARTER_SCRIPT_ID = 'driving-beginner';

/** The env to read a script against: its own when the app has a lab for it, else the Studio default. */
export function studioEnvOf(env: EnvId | null | undefined): EnvId {
  return env && isLabEnv(env) ? env : DEFAULT_SCRIPT_ENV;
}

/**
 * True for a stored script the Studio can show: one of an env with a lab.
 * Scripts saved for a lab a later version removed stay in the browser's
 * storage but never show.
 */
export function shownScript(entry: { env: string }): boolean {
  return isLabEnv(entry.env);
}
