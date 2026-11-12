import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/** The src folder, so tests can name entries as 'engine/lessons/evaluate.ts'. */
export const SRC = resolve(__dirname, '../../..');

/** The file an import specifier points at, or null for packages and JSON content. */
function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const file of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) if (/\.tsx?$/.test(file) && existsSync(file)) return file;
  return null;
}

/**
 * Every module reachable from `entry` (relative to src) through static
 * imports, with the packages each one imports. Dynamic import() calls and
 * workers are not followed: they become chunks that load on demand.
 * Side effect imports such as `import './setup'` are followed.
 */
export function staticGraph(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const queue = [join(SRC, entry)];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    const text = readFileSync(file, 'utf8');
    // Type-only imports are erased at build time, so they are skipped.
    const specs = [...text.matchAll(/^(?:import|export)\s(?!type\s)[^;]*?from\s+'([^']+)'/gm), ...text.matchAll(/^import\s+'([^']+)'/gm)].map((m) => m[1]);
    seen.set(file, specs);
    for (const spec of specs) {
      const next = resolveImport(file, spec);
      if (next) queue.push(next);
    }
  }
  return seen;
}

/**
 * Files in the static graph of `entry` that hold an env's simulation: its
 * module or its env class, relative to src. An env's light info never
 * reaches them, so a page that reaches one ships the whole simulation
 * instead of loading it when it first needs it (loadEpisodeModule).
 */
export function simulationImporters(entry: string): string[] {
  return [...staticGraph(entry).keys()].map((f) => relative(SRC, f)).filter((f) => /^engine\/[a-z]+\/(module|env)\.ts$/.test(f));
}
