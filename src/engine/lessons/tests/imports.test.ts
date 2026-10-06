import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../..');
const RAPIER = '@dimforge/rapier3d-compat';

/** The file an import specifier points at, or null for packages and JSON content. */
function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const file of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) if (existsSync(file)) return file;
  return null;
}

/**
 * Every module reachable from `entry` through static imports, with the
 * packages each one imports. Dynamic import() calls are not followed:
 * they become chunks that load on demand.
 */
function staticGraph(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    // Type-only imports are erased at build time, so they are skipped.
    const specs = [...readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s(?!type\s)[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    seen.set(file, specs);
    for (const spec of specs) {
      const next = resolveImport(file, spec);
      if (next) queue.push(next);
    }
  }
  return seen;
}

describe('lesson check imports', () => {
  it('keep Rapier out of the Learn tab until a Hide and Seek check runs', () => {
    for (const entry of ['evaluate.ts', 'validate.ts', 'catalog.ts', 'preview/record.ts']) {
      const graph = staticGraph(join(SRC, 'engine/lessons', entry));
      const offenders = [...graph].filter(([, specs]) => specs.includes(RAPIER)).map(([file]) => file);
      expect(offenders, entry).toEqual([]);
    }
  });

  it('do load Rapier through the Hide and Seek checks and the match preview', () => {
    for (const entry of ['hideseek/checks.ts', 'preview/match.ts']) {
      const graph = staticGraph(join(SRC, 'engine/lessons', entry));
      expect([...graph.values()].some((specs) => specs.includes(RAPIER)), entry).toBe(true);
    }
  });
});
