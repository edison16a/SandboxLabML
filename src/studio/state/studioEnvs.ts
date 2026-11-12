import type { EnvId } from '@/engine/env/types';
import { scriptEnv, type ScriptEnv } from '@/engine/script';
import { isLabEnv, LABS } from '@/features/shell/labs';

/**
 * The envs the Studio offers, in lab order: those the app has a lab for.
 * The engine's script table still lists envs no screen shows any more, so
 * every Studio list (env filter, starters, presets, lessons, palette,
 * reference, test run and bench) reads this instead of the table.
 */
export function studioEnvs(): ScriptEnv[] {
  return LABS.map((lab) => scriptEnv(lab.env)).filter((e): e is ScriptEnv => e !== undefined);
}

/** The env the Studio assumes for a script without a usable header, and offers first. */
export const STUDIO_DEFAULT_ENV: EnvId = LABS[0].env;

/** The script a newcomer opens on: the Driving Beginner preset. */
export const STARTER_SCRIPT_ID = 'driving-beginner';

/** The env to read a script against: its own when the app has a lab for it, else the Studio default. */
export function studioEnvOf(env: EnvId | null | undefined): EnvId {
  return env && isLabEnv(env) ? env : STUDIO_DEFAULT_ENV;
}

/** True for a stored script or preset the Studio can show: one of an env with a lab. */
export function shownScript(entry: { env: string }): boolean {
  return isLabEnv(entry.env);
}
