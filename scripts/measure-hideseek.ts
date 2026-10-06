/**
 * Measures how visibly both Hide and Seek teams learn. It runs a headless
 * co-evolution and, at generation 0 and every few generations, plays the
 * whole population against fixed yardsticks on fixed seeds:
 *
 *   hiders against the scripted seeker (hidden share)
 *   hiders against the held-out scanner seeker, which no run trains with
 *   seekers against the scripted hider (seen share)
 *
 * Each is a population mean with its standard error over genomes. The
 * summary gives the change from generation 0 in standard errors, plus the
 * co-evolution curve (one row per generation).
 *
 *   npx tsx scripts/measure-hideseek.ts --setup v2 --generations 60 --workers 2
 *
 * The numbers behind the choice of the v2 setup are in the docs of
 * HIDESEEK_SETUPS (src/engine/hideseek/trainer/setups.ts). Expect about
 * 8 s per generation at 50 per team on two worker threads.
 *
 * Options, all optional: --setup v1|v2 (default v2), --generations 60,
 * --population 50, --seed 1, --workers 2, --every 10, --matches 6 (per
 * genome per yardstick at the start and the end), --curve-matches 3 (the
 * same in between), --inputs standard|starter|advanced, --reward
 * v1|starter|cover, --opponents current,hallOfFame,scripted (like 2,1,1),
 * --mix true|false, --shared true|false, --prep seconds, --preset id (an
 * SBL preset drives both teams and its generation block, and its brain
 * wins over --inputs), --script file (the same for a script file),
 * --quiet (no per generation rows).
 */
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { HIDESEEK_BLUEPRINTS } from '../src/engine/blueprints/presets';
import { HideSeekTrainer, type HideSeekGenerationStats, type HideSeekRewardId, type HideSeekSetupId, type HideSeekTrainerOptions } from '../src/engine/hideseek';
import { compileScript, createScriptHost, findScriptPreset } from '../src/engine/script';
import { Farm } from './hideseek/farm';
import { allYardsticks, formatMeasure, formatRooms, zScore, type Yardsticks } from './hideseek/yardsticks';

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? 'true' : (argv[i + 1] ?? 'true');
  return out;
}

/** Trainer options from the command line. A preset's own brain wins over --inputs. Anything not given comes from the setup. */
function optionsFrom(args: Record<string, string>, customSensors: number, presetBrain: string | null): HideSeekTrainerOptions {
  const tier = args.inputs ?? 'standard';
  const blueprint = HIDESEEK_BLUEPRINTS.find((b) => (presetBrain ? b.id === presetBrain : b.tier === tier));
  if (!blueprint) throw new Error(`Unknown inputs "${presetBrain ?? tier}". Use starter, standard or advanced.`);
  const o: HideSeekTrainerOptions = {
    seed: Number(args.seed ?? 1),
    setup: (args.setup ?? 'v2') as HideSeekSetupId,
    hiderInputs: blueprint.inputs,
    seekerInputs: blueprint.inputs,
    populationSize: Number(args.population ?? 50),
    hiderCustomSensors: customSensors,
    seekerCustomSensors: customSensors,
  };
  if (args.reward) o.reward = args.reward as HideSeekRewardId;
  if (args.opponents) {
    const [current, hallOfFame, scripted] = args.opponents.split(',').map(Number);
    o.opponents = { current, hallOfFame, scripted };
  }
  if (args.mix) o.mixLayouts = args.mix === 'true';
  if (args.shared) o.sharedSeeds = args.shared === 'true';
  if (args.prep) o.prepSeconds = Number(args.prep);
  return o;
}

function row(s: HideSeekGenerationStats, seconds: number): string {
  const g = s.game;
  const f = (v: number | undefined, d = 2) => (v === undefined ? '     -' : v.toFixed(d).padStart(6));
  return (
    `${String(s.generation).padStart(4)} | current hidden ${f(g.currentHiddenShare)} exposed ${f(g.exposedShare)} | ` +
    `sparring hidden ${f(g.scriptedHiddenShare)} seen ${f(g.scriptedSeenShare)} | locks ${f(g.locksPerMatch)} | ` +
    `hider ${f(s.hiders.best, 1)} ${f(s.hiders.mean, 1)} seeker ${f(s.seekers.best, 1)} ${f(s.seekers.mean, 1)} | ${seconds.toFixed(1)} s`
  );
}

function bench(generation: number, y: Yardsticks, seconds: number): string {
  return (
    `bench ${String(generation).padStart(4)} | hiders vs scripted ${formatMeasure(y.hidersVsScripted)} | ` +
    `hiders vs held-out ${formatMeasure(y.hidersVsHeldOut)} | seekers vs scripted hider ${formatMeasure(y.seekersVsScripted)} | ${seconds.toFixed(1)} s`
  );
}

/** SBL source from --preset (a preset id) or --script (a file), or undefined for the built-in rewards. */
function scriptSource(args: Record<string, string>): string | undefined {
  if (args.script) return readFileSync(args.script, 'utf8');
  if (!args.preset) return undefined;
  const preset = findScriptPreset(args.preset);
  if (!preset) throw new Error(`Unknown preset "${args.preset}".`);
  return preset.source;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const generations = Number(args.generations ?? 60);
  const every = Math.max(1, Number(args.every ?? 10));
  const ends = Math.max(1, Number(args.matches ?? 6));
  const between = Math.max(1, Number(args['curve-matches'] ?? 3));
  const source = scriptSource(args);
  const host = source ? createScriptHost(source) : undefined;
  const brain = source ? (compileScript(source).script?.header.brain ?? null) : null;
  const trainer = HideSeekTrainer.create(optionsFrom(args, host?.customSensors.length ?? 0, brain), host);
  const farm = new Farm(Number(args.workers ?? Math.min(2, Math.max(0, availableParallelism() - 1))));
  const o = trainer.options;
  const opp = o.opponents;
  console.log(
    `Hide and Seek measurement: setup ${o.setup}, reward ${o.reward}, ${o.populationSize} per team, rounds ${opp.current} current + ${opp.hallOfFame} hall of fame + ` +
      `${opp.scripted} scripted, mixed rooms ${o.mixLayouts}, shared seeds ${o.sharedSeeds}, prep ${o.prepSeconds ?? 'default'}, seed ${o.seed}${source ? `, script ${args.preset ?? args.script}` : ''}`,
  );
  const timed = async (perGenome: number) => {
    const t0 = performance.now();
    const y = await allYardsticks(farm, trainer, perGenome, source);
    console.log(bench(trainer.generation, y, (performance.now() - t0) / 1000));
    return y;
  };
  const start = await timed(ends);
  let last = start;
  const t0 = performance.now();
  while (trainer.generation < generations) {
    const g0 = performance.now();
    const results = await farm.runPlan(trainer.planGeneration(), source);
    const stats = trainer.completeGeneration(results, {}, host);
    if (!args.quiet) console.log(row(stats, (performance.now() - g0) / 1000));
    if (trainer.generation === generations) last = await timed(ends);
    else if (trainer.generation % every === 0) await timed(between);
  }
  const minutes = (performance.now() - t0) / 60000;
  const z = (k: keyof Yardsticks) =>
    `${formatMeasure(start[k])} to ${formatMeasure(last[k])}, ${zScore(start[k], last[k]).toFixed(1)} SE (by room: ${formatRooms(start[k])} to ${formatRooms(last[k])})`;
  console.log(`Summary after ${generations} generations (${minutes.toFixed(1)} min including benchmarks):`);
  console.log(`  hiders vs scripted seeker, hidden share: ${z('hidersVsScripted')}`);
  console.log(`  hiders vs held-out seeker, hidden share: ${z('hidersVsHeldOut')}`);
  console.log(`  seekers vs scripted hider, seen share:   ${z('seekersVsScripted')}`);
  farm.close();
}

void main();
