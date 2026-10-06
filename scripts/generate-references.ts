/**
 * Regenerates the benchmark reference files under public/references: the
 * curves the Bench tab and the Progress charts draw next to a user's score
 * and, for Hide and Seek, the reference champions the exam plays against.
 *
 *   npx tsx scripts/generate-references.ts --env all --workers 2
 *
 * --env racing, hideseek or all (the default) picks the environments.
 * --workers 2 sets the worker threads (0 runs everything on this thread).
 * Each environment has its own defaults for seeds, generations and team
 * size, documented in scripts/references/<env>/generate.ts, and any of
 * them can be overridden from the command line when one env is picked.
 * Run it from the repo root.
 */
import { parseArgs } from './references/file';
import { generateHideSeek } from './references/hideseek/generate';
import { JobPool } from './references/pool';
import { generateRacing } from './references/racing/generate';

async function main(): Promise<void> {
  const args = parseArgs();
  const env = args.env ?? 'all';
  if (!['racing', 'hideseek', 'all'].includes(env)) throw new Error(`Unknown --env ${env}. Use racing, hideseek or all.`);
  // Per env options would clash when both run, so --env all always uses the defaults.
  const own = env === 'all' ? { workers: args.workers ?? '2' } : args;
  const pool = new JobPool(Number(args.workers ?? 2));
  const started = performance.now();
  try {
    if (env !== 'hideseek') await generateRacing(own, pool);
    if (env !== 'racing') await generateHideSeek(own, pool);
  } finally {
    await pool.close();
  }
  console.log(`Done in ${((performance.now() - started) / 60000).toFixed(1)} min.`);
}

void main();
