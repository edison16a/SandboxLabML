import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../..');

/** The file an import path points at, or null for a package. */
function locate(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(src, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (existsSync(base + ext)) return base + ext;
  return null;
}

describe('the world builder worker', () => {
  // The app's build treats `typeof window` as known in browser code, so three.js throws when it loads in a worker.
  it('never loads three.js, directly or through anything it imports', () => {
    const seen = new Set<string>();
    const queue = [join(here, 'world.worker.ts')];
    const offenders: string[] = [];
    while (queue.length) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/^import\s+(type\s+)?[^'"]*from\s+'([^']+)';/gm)) {
        if (m[1]) continue;
        if (m[2] === 'three' || m[2].startsWith('three/')) offenders.push(file.slice(src.length));
        const next = locate(file, m[2]);
        if (next) queue.push(next);
      }
    }
    expect(seen.size).toBeGreaterThan(8);
    expect(offenders).toEqual([]);
  });
});
