/**
 * Trains the runner the landing page hero shows, picks the courses it
 * crosses in a loop, and writes public/hero/navigator.json. Training is an
 * ordinary Navigation run (the Starter brain, the built in reward and the
 * automatic curriculum from the straight run up to the Gauntlet). Every
 * champion from the second half of the run then tries the hero's rooms:
 * the named courses with spikes, walls and movers, and generated mover and
 * Gauntlet levels. The one that crosses the most of them cleanly wins
 * (it finishes, with little backing up and no scraping along walls), and
 * its loop opens on the room with the most to see.
 *
 *   npm run hero:navigator -- --seed 3 --generations 60
 *
 * That is how the shipped file was made, in a few minutes on one core.
 *
 * Options, all optional: --seed 3, --generations 60, --population 100,
 * --save file, --pool file[,file] (picks from saved brains instead of
 * training: a reference file or a --save file), --rooms 16 (generated
 * rooms to try), --loop 6 (courses in the loop) and --out
 * public/hero/navigator.json. Run it from the repo root.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { registerEpisodeModule } from '../src/engine/env/registry';
import { HERO_NAVIGATOR_VERSION, type HeroNavigatorFile } from '../src/engine/hero/navigator/file';
import { chooseCourses, cleanCrossing, heroCourses, variety, type CoursePick, type RunnerCandidate } from '../src/engine/hero/navigator/pick';
import { navigationModule } from '../src/engine/navigation/module';
import { NAVIGATION_ENGINE_VERSION } from '../src/engine/navigation/params';
import { NAVIGATION_BLUEPRINTS } from '../src/engine/navigation/pipeline/blueprints';
import { navigationSettings } from '../src/engine/navigation/pipeline/settings';
import { Network } from '../src/engine/neat/network';
import { bytesToBase64, encodeGenome } from '../src/engine/neat/serialize';
import { EpisodeTrainer, trainingControllerSeed } from '../src/engine/training/episodeTrainer';
import { createEpisodeRunConfig } from '../src/engine/training/newRun';
import { loadRunnerPool, numberArg, parseArgs, saveRunnerPool } from './train-hero-pool';

/** Trains a default run and returns every champion from its second half. */
function train(seed: number, generations: number, population: number): RunnerCandidate[] {
  registerEpisodeModule(navigationModule);
  const blueprint = NAVIGATION_BLUEPRINTS[0];
  const config = createEpisodeRunConfig({ env: 'navigation', name: 'Hero runner', seed, blueprint, populationSize: population, settings: { ...navigationSettings() } });
  const trainer = new EpisodeTrainer(navigationModule, config);
  const out: RunnerCandidate[] = [];
  while (trainer.generation <= generations) {
    const env = navigationModule.createEnv(trainer.setup(), trainer.host(), trainingControllerSeed(trainer.generation));
    env.reset(
      trainer.genomes.map((g) => new Network(g)),
      trainer.seeds(),
      trainer.slots(),
    );
    while (!env.done) env.step();
    const record = trainer.complete(env.results(), 0);
    console.log(`generation ${record.generation}, best ${record.stats.best.toFixed(1)}`);
    if (record.generation >= generations / 2) out.push({ label: `Default run, seed ${seed}, generation ${record.generation}`, genome: record.genome, blueprint: blueprint.id, inputs: blueprint.inputs });
  }
  return out;
}

/** The candidate that crosses the most rooms cleanly, weighted by what each room shows. */
function pickRunner(candidates: RunnerCandidate[], rooms: number): { best: RunnerCandidate; picks: CoursePick[] } {
  const specs = heroCourses(rooms);
  let best: { best: RunnerCandidate; picks: CoursePick[]; score: number } | null = null;
  for (const c of candidates) {
    const picks = specs.map((s) => cleanCrossing(c, s)).filter((p): p is CoursePick => p !== null);
    const score = picks.reduce((sum, p) => sum + 1 + variety(p.spec) * 0.1 - p.report.wobble * 0.4 - p.report.touching * 0.1, 0);
    console.log(`${c.label}: ${picks.length} of ${specs.length} rooms crossed cleanly`);
    if (!best || score > best.score) best = { best: c, picks, score };
  }
  if (!best || best.picks.length === 0) throw new Error('No candidate crossed a single hero room cleanly.');
  return best;
}

function main(): void {
  const args = parseArgs();
  const out = args.out ?? 'public/hero/navigator.json';
  const seed = numberArg(args, 'seed', 3);
  const candidates = args.pool ? loadRunnerPool(args.pool.split(',')) : train(seed, numberArg(args, 'generations', 60), numberArg(args, 'population', 100));
  if (args.save) saveRunnerPool(args.save, candidates);
  const { best, picks } = pickRunner(candidates, numberArg(args, 'rooms', 16));
  const loop = chooseCourses(picks, numberArg(args, 'loop', 6));
  for (const p of loop) console.log(`${p.spec.name} (level ${p.spec.level}): ${p.report.seconds.toFixed(1)} s from spot ${p.slot}`);
  const file: HeroNavigatorFile = {
    version: HERO_NAVIGATOR_VERSION,
    engineVersion: NAVIGATION_ENGINE_VERSION,
    blueprint: best.blueprint,
    inputs: best.inputs,
    courses: loop.map(({ spec, slot, seed: s }) => ({ spec, slot, seed: s })),
    source: best.label,
    genome: bytesToBase64(encodeGenome(best.genome)),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`Wrote ${out}: ${best.label}, ${loop.length} courses`);
}

main();
