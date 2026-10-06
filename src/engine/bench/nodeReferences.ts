import { readFile } from 'node:fs/promises';
import type { EnvId } from '../env/types';
import { parseReferences } from './references';
import type { BenchReferences } from './types';

/**
 * Reads a reference file from disk, for tests and the generator script.
 * The browser loads the same file with loadReferences. This module uses
 * node:fs, so it is kept out of the bench index and never bundled.
 */
export async function readReferences(env: EnvId, root = process.cwd()): Promise<BenchReferences | null> {
  try {
    const text = await readFile(`${root}/public/references/${env}.json`, 'utf8');
    return parseReferences(JSON.parse(text));
  } catch {
    return null;
  }
}
