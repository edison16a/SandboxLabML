/**
 * Trains the SUV the landing page hero shows, picks the trips it drives in
 * a loop, and writes public/hero/driver.json. Training is an ordinary
 * Driving run (the default brain, the built in reward, Midtown and the
 * automatic curriculum), the run a newcomer gets in the lab. Every
 * champion from the second half of the run then drives many trips at the
 * hero's level, and the one with the most clean arrivals wins: no crash,
 * no person hit, no red light run, no wheel over the curb. Its loop is a
 * handful of those trips, picked to show a stop at a red and a stop for
 * a person.
 *
 *   npm run hero:driver -- --seed 7 --generations 220
 *   npm run hero:driver -- --pool public/references/driving.json
 *
 * Options, all optional: --seed 7, --generations 220, --population 100,
 * --save file (writes the trained champions, to pick again later),
 * --pool file[,file] (picks from saved brains instead of training: a
 * reference file, a reference generator dump or a --save file), --level 4,
 * --city midtown, --tries 80 (trip seeds per finalist), --loop 5 (trips in
 * the loop), --budget 240 (seconds of driving in the loop), --order 2,0,1
 * (puts the picked trips in this order) and --out public/hero/driver.json.
 * Run it from the repo root. Training and picking are deterministic.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mixSeed } from '../src/engine/core/rng';
import { DEFAULT_DRIVING_BLUEPRINT } from '../src/engine/driving/blueprints';
import { drivingModule } from '../src/engine/driving/module';
import { DEFAULT_DRIVING_SETTINGS } from '../src/engine/driving/run/settings';
import type { DrivingInputConfig } from '../src/engine/driving/sensors/inputConfig';
import { DRIVING_ENGINE_VERSION } from '../src/engine/driving/version';
import { HERO_DRIVER_VERSION, type HeroDriverFile } from '../src/engine/hero/driver/file';
import { chooseLoop, interest, showableTrips, type DriverCandidate, type TripPick } from '../src/engine/hero/driver/pick';
import { Network } from '../src/engine/neat/network';
import { bytesToBase64, encodeGenome } from '../src/engine/neat/serialize';
import { EpisodeTrainer, trainingControllerSeed } from '../src/engine/training/episodeTrainer';
import { createEpisodeRunConfig } from '../src/engine/training/newRun';
import { loadDriverPool, numberArg, parseArgs, saveDriverPool } from './train-hero-pool';

/** Salt of the hero's trip seeds, so they are not the trips any benchmark or test drives. */
const TRIP_SALT = 0x4e70;
/** Trips every candidate drives first. Only the best few drive the full set. */
const FIRST_LOOK = 12;
const FINALISTS = 10;

/** Trains a default run and returns every champion from its second half, oldest first. */
function train(seed: number, generations: number, population: number): DriverCandidate[] {
  const blueprint = DEFAULT_DRIVING_BLUEPRINT;
  const config = createEpisodeRunConfig({ env: 'driving', name: 'Hero driver', seed, blueprint, populationSize: population, settings: { ...DEFAULT_DRIVING_SETTINGS } });
  const trainer = new EpisodeTrainer(drivingModule, config);
  const out: DriverCandidate[] = [];
  const started = performance.now();
  while (trainer.generation <= generations) {
    const level = trainer.content.level;
    const env = drivingModule.createEnv(trainer.setup(), trainer.host(), trainingControllerSeed(trainer.generation));
    env.reset(
      trainer.genomes.map((g) => new Network(g)),
      trainer.seeds(),
    );
    while (!env.done) env.step();
    const record = trainer.complete(env.results(), 0);
    const minutes = ((performance.now() - started) / 60000).toFixed(1);
    console.log(`generation ${record.generation}, level ${level}, best ${record.stats.best.toFixed(1)}, ${minutes} min`);
    if (record.generation >= generations / 2) {
      out.push({ label: `Default run, seed ${seed}, generation ${record.generation}`, genome: record.genome, blueprint: blueprint.id, inputs: blueprint.inputs as DrivingInputConfig, brainSeed: 0 });
    }
  }
  return out;
}

/** The candidate with the most showable trips, the total interest of those trips breaking a tie. */
function pickDriver(candidates: DriverCandidate[], city: string, level: number, tries: number): { best: DriverCandidate; trips: TripPick[] } {
  const seeds = Array.from({ length: tries }, (_, k) => mixSeed(TRIP_SALT, k));
  const rank = (trips: TripPick[]) => trips.length * 100 + trips.reduce((sum, t) => sum + interest(t.report), 0);
  const first = candidates.map((c) => ({ c, score: rank(showableTrips(c, city, level, seeds.slice(0, FIRST_LOOK))) }));
  first.sort((a, b) => b.score - a.score);
  let best: { best: DriverCandidate; trips: TripPick[]; score: number } | null = null;
  for (const { c } of first.slice(0, FINALISTS)) {
    const trips = showableTrips(c, city, level, seeds);
    const score = rank(trips);
    console.log(`${c.label}: ${trips.length} of ${tries} trips fit for the hero`);
    if (!best || score > best.score) best = { best: c, trips, score };
  }
  if (!best || best.trips.length === 0) throw new Error('No candidate drove a single trip fit for the hero.');
  return best;
}

function main(): void {
  const args = parseArgs();
  const city = args.city ?? 'midtown';
  const level = numberArg(args, 'level', 4);
  const out = args.out ?? 'public/hero/driver.json';
  const seed = numberArg(args, 'seed', 7);
  const candidates = args.pool ? loadDriverPool(args.pool.split(',')) : train(seed, numberArg(args, 'generations', 220), numberArg(args, 'population', 100));
  if (args.save) saveDriverPool(args.save, candidates);
  console.log(`${candidates.length} candidates`);
  const { best, trips } = pickDriver(candidates, city, level, numberArg(args, 'tries', 80));
  let loop = chooseLoop(trips, numberArg(args, 'loop', 5), numberArg(args, 'budget', 240));
  if (args.order) loop = args.order.split(',').map((k) => loop[Number(k)]).filter(Boolean);
  for (const t of loop) {
    const r = t.report;
    console.log(`trip ${t.seed}: ${r.seconds.toFixed(0)} s, ${r.turns} turns, ${r.redStops} red stops (longest ${r.redWait.toFixed(1)} s), longest wait for a person ${r.personWait.toFixed(1)} s`);
  }
  const file: HeroDriverFile = {
    version: HERO_DRIVER_VERSION,
    engineVersion: DRIVING_ENGINE_VERSION,
    city,
    level,
    blueprint: best.blueprint,
    inputs: best.inputs,
    brainSeed: best.brainSeed,
    trips: loop.map((t) => t.seed),
    source: best.label,
    genome: bytesToBase64(encodeGenome(best.genome)),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`Wrote ${out}: ${best.label}, ${loop.length} trips`);
}

main();
