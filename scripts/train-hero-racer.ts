/**
 * Trains the car the landing page hero shows driving, and writes it to
 * public/hero/racer.json. It is an ordinary training run, the same trainer
 * and built-in reward the Racing lab uses, on the Grand Prix with the
 * Standard brain. Every generation champion that finishes a lap is then
 * driven alone for many laps in a row; the fastest one that never crashes
 * or weaves is kept, because the hero replays it lap after lap.
 *
 *   npx tsx scripts/train-hero-racer.ts --seed 3 --generations 150
 *
 * Options, all optional: --seed 3, --generations 150, --population 150,
 * --laps 8 (laps a champion must drive cleanly), --out
 * public/hero/racer.json. Run it from the repo root. Training is
 * deterministic, so the same options always give the same car.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { findPresetBlueprint } from '../src/engine/blueprints/presets';
import type { RacingBlueprint } from '../src/engine/blueprints/types';
import { mixSeed } from '../src/engine/core/rng';
import { ENGINE_VERSION } from '../src/engine/core/version';
import { Network } from '../src/engine/neat/network';
import { bytesToBase64, encodeGenome } from '../src/engine/neat/serialize';
import type { Genome } from '../src/engine/neat/types';
import { STATUS_DRIVING } from '../src/engine/racing/car/runtime';
import { RacingEnv } from '../src/engine/racing/env';
import { evaluateRacing } from '../src/engine/racing/episode';
import { findTrack } from '../src/engine/racing/track/presets';
import { HERO_RACER_VERSION, type HeroRacerFile } from '../src/engine/showcase/racer';
import { envOptionsFor, TrackCache, type RacingSetup } from '../src/engine/training/racingSetup';
import { RacingTrainer } from '../src/engine/training/racingTrainer';
import { createRacingRunConfig } from '../src/engine/training/runConfig';
import { builtinHost } from '../src/engine/training/scriptHost';
import { parseArgs, numberArg } from './references/file';

const TRACK = 'grand-prix';
const BLUEPRINT = 'racing-standard';

/** How a champion drives when nothing stops it but a crash or a stall. */
interface LongDrive {
  laps: number;
  bestLap: number;
  crashed: boolean;
  /** Mean change of the steering command per tick. A weaving car reads as broken in a chase camera. */
  weave: number;
}

/** Drives one genome alone, the way the replay worker will, for up to `laps` laps. */
function driveLong(genome: Genome, setup: RacingSetup, seed: number, laps: number, tracks: TrackCache): LongDrive {
  const track = tracks.get(setup.track);
  const env = new RacingEnv(envOptionsFor({ ...setup, maxTime: laps * 120 }, track, builtinHost, mixSeed(0x9405)));
  env.reset([new Network(genome)], [seed]);
  let weave = 0;
  let last = 0;
  const rc = () => env.cars[0];
  while (!env.done && rc().lap < laps) {
    env.step();
    weave += Math.abs(rc().car.steerCmd - last);
    last = rc().car.steerCmd;
  }
  const car = rc();
  return { laps: car.lap, bestLap: car.bestLapTime, crashed: car.status !== STATUS_DRIVING && car.lap < laps, weave: weave / Math.max(1, env.tick) };
}

function main(): void {
  const args = parseArgs();
  const seed = numberArg(args, 'seed', 3);
  const generations = numberArg(args, 'generations', 150);
  const population = numberArg(args, 'population', 150);
  const laps = numberArg(args, 'laps', 8);
  const out = args.out ?? 'public/hero/racer.json';
  const spec = findTrack(TRACK);
  const blueprint = findPresetBlueprint(BLUEPRINT) as RacingBlueprint | undefined;
  if (!spec || !blueprint) throw new Error('The hero track or brain is missing from the presets.');

  const config = createRacingRunConfig({ name: 'Hero racer', seed, blueprint, track: spec, carPreset: 'standard', populationSize: population });
  const trainer = new RacingTrainer(config);
  const tracks = new TrackCache();
  let best: { file: HeroRacerFile; score: number } | null = null;
  const started = performance.now();

  while (trainer.generation < generations) {
    const setup = trainer.setup();
    const opts = envOptionsFor(setup, tracks.get(setup.track), trainer.host(), mixSeed(trainer.generation, 0x51));
    const record = trainer.complete(evaluateRacing(trainer.genomes, opts, trainer.seeds()), 0);
    const c = record.champion;
    let note = '';
    if (c.laps >= 1) {
      const drive = driveLong(record.genome, setup, record.replaySeed, laps, tracks);
      // Lap time decides, with a penalty for weaving so a smooth car wins a close race.
      const score = drive.bestLap * (1 + drive.weave * 4);
      note = `long drive ${drive.laps} laps, best ${drive.bestLap.toFixed(2)} s, weave ${drive.weave.toFixed(4)}${drive.crashed ? ', crashed' : ''}`;
      if (!drive.crashed && drive.laps >= laps && (!best || score < best.score)) {
        best = {
          score,
          file: {
            version: HERO_RACER_VERSION,
            engineVersion: ENGINE_VERSION,
            track: TRACK,
            carPreset: 'standard',
            blueprint: BLUEPRINT,
            seed,
            generation: record.generation,
            replaySeed: record.replaySeed,
            lapTime: Math.round(drive.bestLap * 100) / 100,
            genome: bytesToBase64(encodeGenome(record.genome)),
          },
        };
        note += ', kept';
      }
    }
    console.log(`gen ${String(record.generation).padStart(3)} fitness ${c.fitness.toFixed(1).padStart(7)} laps ${c.laps} ${note}`);
  }
  if (!best) throw new Error('No champion drove the laps cleanly. Try more generations or another seed.');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(best.file, null, 2)}\n`);
  console.log(`Kept generation ${best.file.generation}, best lap ${best.file.lapTime} s. Wrote ${out} in ${((performance.now() - started) / 1000).toFixed(0)} s.`);
}

main();
