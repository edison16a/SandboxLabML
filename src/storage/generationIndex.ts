import { db } from './db';

/**
 * Generation numbers stored for a run, oldest first. Reads keys only, so
 * listing a long run does not decode every champion genome the way
 * loadHistory does.
 */
export async function listGenerationNumbers(runId: string): Promise<number[]> {
  const keys = await db().generations.where('runId').equals(runId).primaryKeys();
  return keys.map((k) => k[1]).sort((a, b) => a - b);
}

/** The same for a Hide and Seek run, whose generations live in their own table. */
export async function listHideSeekGenerationNumbers(runId: string): Promise<number[]> {
  const keys = await db().hsGenerations.where('runId').equals(runId).primaryKeys();
  return keys.map((k) => k[1]).sort((a, b) => a - b);
}
