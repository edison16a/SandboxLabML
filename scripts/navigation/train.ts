/**
 * Trains a default Navigation run (no script, the built in reward and the
 * automatic curriculum) through the real coordinator and sim code at Max,
 * and prints one line per generation: the level, the share of runs that
 * finished, the share the best fifth finished, deaths, the best fitness
 * and the wall time.
 *
 *   npx tsx scripts/navigation/train.ts --seed 1 --generations 80
 *
 * Options, all optional: --seed 1, --generations 80, --population 100,
 * --blueprint navigation-standard, --level 0, --courses 2.
 */
import { numberArg, parseArgs } from '../references/file';
import { describeRecord, trainThroughPipeline } from './pipelineRun';

async function main() {
  const args = parseArgs();
  const started = performance.now();
  const records = await trainThroughPipeline({
    seed: numberArg(args, 'seed', 1),
    generations: numberArg(args, 'generations', 80),
    population: numberArg(args, 'population', 100),
    blueprint: args.blueprint || undefined,
    settings: { startLevel: numberArg(args, 'level', 0), coursesPerGeneration: numberArg(args, 'courses', 2) },
    onGeneration: (r) => console.log(describeRecord(r)),
  });
  const firstAt = new Map<number, number>();
  for (const r of records) {
    const level = r.metrics?.level ?? 0;
    if (!firstAt.has(level)) firstAt.set(level, r.generation + 1);
  }
  const wall = records.reduce((s, r) => s + r.wallMs, 0) / Math.max(1, records.length);
  console.log(`\nfirst generation on each level: ${[...firstAt].map(([l, g]) => `${l}@${g}`).join(', ')}`);
  console.log(`mean wall time per generation: ${Math.round(wall)} ms (one thread), total ${Math.round((performance.now() - started) / 1000)} s`);
}

void main();
