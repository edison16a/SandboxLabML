import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseReferences } from '../../src/engine/bench/references';
import type { BenchReferences } from '../../src/engine/bench/types';

/** Command line options as `--name value` pairs. A flag with no value reads as an empty string. */
export type Args = Record<string, string>;

export function parseArgs(argv = process.argv.slice(2)): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  return out;
}

/** A numeric option, or the environment's own default when it is not given. */
export function numberArg(args: Args, name: string, fallback: number): number {
  return args[name] !== undefined ? Number(args[name]) : fallback;
}

/**
 * Keeps the old generatedAt when nothing else changed. Training is
 * deterministic, so a nightly rerun on an unchanged engine writes the same
 * file and the workflow has nothing to commit.
 */
function stableDate(path: string, next: BenchReferences): BenchReferences {
  if (!existsSync(path)) return next;
  const old = parseReferences(JSON.parse(readFileSync(path, 'utf8')));
  if (!old) return next;
  const same = JSON.stringify({ ...old, generatedAt: '' }) === JSON.stringify({ ...next, generatedAt: '' });
  return same ? { ...next, generatedAt: old.generatedAt } : next;
}

/**
 * Pretty JSON with one curve point per line and each input config on one
 * line, so a regenerated file reads well in a diff. Genomes stay single
 * base64 strings.
 */
function format(file: BenchReferences): string {
  const inline: string[] = [];
  const text = JSON.stringify(file, (key, value: unknown) => (key === 'inputs' ? `@inline${inline.push(JSON.stringify(value)) - 1}` : value), 2)
    .replace(/\{\n\s+("generation"[^}]*?)\n\s+\}/g, (_m, body: string) => `{ ${body.replace(/,\n\s+/g, ', ')} }`)
    .replace(/"@inline(\d+)"/g, (_m, i: string) => inline[Number(i)]);
  return `${text}\n`;
}

/** Writes a reference file, keeping the old date when the content is the same. */
export function writeReferences(path: string, file: BenchReferences): void {
  writeFileSync(path, format(stableDate(path, file)));
}
