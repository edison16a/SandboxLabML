import type { Blueprint } from '@/engine/blueprints/types';
import type { CustomSensorSpec, EnvId } from '@/engine/env/types';
import type { RunConfig } from '@/engine/training/runConfig';
import { isLabEnv, labPath } from '@/features/shell/labs';
import type { RunRow } from '@/storage/db';
import { importRun, ImportError } from '@/storage/exportImport';
import { forkRun } from '@/storage/forkRun';
import { destroyRun, listTrash } from '@/storage/runs';

/**
 * What the app says about a run of a lab this version does not have. The
 * same sentence the import refuses with once the engine forgets the env.
 */
export const RETIRED_RUN = 'This run is from a lab this version does not have.';

/**
 * The runs the app shows: only those of a lab this version has. Runs of a
 * removed lab stay in the browser's storage, untouched, but never show.
 */
export function shownRuns<T extends Pick<RunRow, 'env'>>(rows: readonly T[]): T[] {
  return rows.filter((r) => isLabEnv(r.env));
}

/**
 * Empties the Trash the Runs page shows. A trashed run of a removed lab
 * never shows there, so it stays stored like that lab's other runs.
 */
export async function emptyLabTrash(): Promise<void> {
  for (const row of shownRuns(await listTrash())) await destroyRun(row.id);
}

/**
 * Stops an action on a run of a removed lab (branch, rewind, fork and the
 * rest) with the plain message, before it touches storage. Such runs never
 * show, so this only guards a stale link or an old tab.
 */
export function requireLabRun<T extends Pick<RunRow, 'env'>>(row: T): T {
  if (!isLabEnv(row.env)) throw new Error(RETIRED_RUN);
  return row;
}

/** Forks a run into a new one with a bigger brain, refusing a run of a removed lab. */
export async function forkLabRun(run: Pick<RunConfig, 'id' | 'env'>, blueprint: Blueprint, custom: CustomSensorSpec[] = []): Promise<RunConfig> {
  return forkRun(requireLabRun(run).id, blueprint, custom);
}

/** The env a run file names, read without importing it, or null when the file says none. */
export function runFileEnv(text: string): string | null {
  try {
    const env = (JSON.parse(text) as { config?: { env?: unknown } } | null)?.config?.env;
    return typeof env === 'string' ? env : null;
  } catch {
    return null;
  }
}

/**
 * Imports a run file, turning away one of a lab this version does not
 * have before anything is stored. Any other problem keeps the import's own
 * message, such as a file that is not JSON.
 */
export async function importLabRun(text: string): Promise<RunConfig> {
  const env = runFileEnv(text);
  if (env !== null && !isLabEnv(env)) throw new ImportError(RETIRED_RUN);
  return importRun(text);
}

/** What a run link does in a lab: open here, move to the lab the run belongs to, or explain why it cannot open. */
export type RunLink = { kind: 'open' } | { kind: 'elsewhere'; path: string } | { kind: 'problem'; message: string };

/**
 * Where a link to run `id` should go from the lab for `env`. A run of the
 * other lab moves there; a run that is gone, trashed or from a removed lab
 * gets one short sentence, and the lab opens its usual run instead.
 */
export function runLink(row: Pick<RunRow, 'env' | 'deletedAt'> | undefined, env: EnvId, id: string): RunLink {
  if (!row) return { kind: 'problem', message: 'That run is not on this device any more.' };
  if (!isLabEnv(row.env)) return { kind: 'problem', message: RETIRED_RUN };
  if (row.deletedAt) return { kind: 'problem', message: 'That run is in the Trash. Restore it from the Runs page.' };
  if (row.env !== env) return { kind: 'elsewhere', path: `${labPath(row.env)}?run=${encodeURIComponent(id)}` };
  return { kind: 'open' };
}
