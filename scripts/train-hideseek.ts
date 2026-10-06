/**
 * Headless Hide and Seek co-evolution for long runs. Prints one line per
 * generation, and every few generations how long the current hiders stay
 * hidden against the scripted seeker. That second number is the fair
 * measure of hider skill: in co-evolution the seekers keep improving too,
 * so hidden time against them can stay flat while both teams get better.
 * For standard errors and the seeker side, use measure-hideseek.ts.
 *
 *   npx tsx scripts/train-hideseek.ts --generations 200 --population 50 --workers 2
 *
 * Run it from the repo root. Options, all optional: --generations 200,
 * --population 50, --seed 1, --setup v2 (or v1, the original rules),
 * --rounds (1 to 4, v1 style), --workers (cores minus one, 0 runs
 * everything on the main thread), --bench-every 5, --save file.json (a
 * checkpoint written at the end), --resume file.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { HideSeekTrainer, STANDARD_HIDESEEK_INPUTS, type HideSeekGenerationStats, type HideSeekSetupId } from '../src/engine/hideseek';
import { Farm } from './hideseek/farm';
import { benchmark } from './hideseek/yardsticks';

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  return out;
}

function row(s: HideSeekGenerationStats, seconds: number): string {
  const g = s.game;
  const f = (v: number | undefined, d = 2) => (v === undefined ? '     -' : v.toFixed(d).padStart(6));
  return (
    `${String(s.generation).padStart(4)} | hidden ${f(g.hiddenShare)} current ${f(g.currentHiddenShare)} sparring ${f(g.scriptedHiddenShare)} | ` +
    `locks ${f(g.locksPerMatch)} moved ${f(g.boxesMovedPerMatch)} grabs ${f(g.grabsPerMatch)} | ` +
    `hider ${f(s.hiders.best, 1)} ${f(s.hiders.mean, 1)} seeker ${f(s.seekers.best, 1)} ${f(s.seekers.mean, 1)} | ` +
    `species ${s.hiders.species.length}/${s.seekers.species.length} | ${seconds.toFixed(1)} s`
  );
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

async function main(): Promise<void> {
  const args = parseArgs();
  const generations = Number(args.generations ?? 200);
  const benchEvery = Math.max(1, Number(args['bench-every'] ?? 5));
  const trainer = args.resume
    ? HideSeekTrainer.fromState(JSON.parse(readFileSync(args.resume, 'utf8')))
    : HideSeekTrainer.create({
        seed: Number(args.seed ?? 1),
        setup: (args.setup ?? 'v2') as HideSeekSetupId,
        hiderInputs: STANDARD_HIDESEEK_INPUTS,
        seekerInputs: STANDARD_HIDESEEK_INPUTS,
        populationSize: Number(args.population ?? 50),
        ...(args.rounds ? { rounds: Number(args.rounds) } : {}),
      });
  const farm = new Farm(Number(args.workers ?? Math.max(0, availableParallelism() - 1)));
  const o = trainer.options;
  console.log(`Hide and Seek co-evolution: setup ${o.setup}, ${o.populationSize} per team, ${o.rounds} rounds, layouts ${o.layouts.join(', ')}, seed ${o.seed}`);
  console.log('hidden: mean share of seek time the hider stayed hidden (all matches / current genomes only / against the scripted seeker in training).');
  const bench = async () => {
    const m = await benchmark(farm, trainer, 'hiders', 'scripted', 1);
    console.log(`bench at generation ${trainer.generation}: hiders hidden ${m.mean.toFixed(3)} ± ${m.se.toFixed(3)} against the scripted seeker`);
    return m;
  };
  const baseline = await bench();
  const first: HideSeekGenerationStats[] = [];
  let last = baseline;
  while (trainer.generation < generations) {
    const t0 = performance.now();
    const stats = trainer.completeGeneration(await farm.runPlan(trainer.planGeneration()));
    if (first.length < 5) first.push(stats);
    console.log(row(stats, (performance.now() - t0) / 1000));
    if (trainer.generation % benchEvery === 0) last = await bench();
  }
  const recent = trainer.history.slice(-5);
  console.log(
    `Summary. Against the scripted seeker: ${baseline.mean.toFixed(3)} at the start, ${last.mean.toFixed(3)} now. ` +
      `Co-evolution hidden share: ${mean(first.map((s) => s.game.hiddenShare)).toFixed(3)} over the first 5 generations, ` +
      `${mean(recent.map((s) => s.game.hiddenShare)).toFixed(3)} over the last 5.`,
  );
  if (args.save) writeFileSync(args.save, JSON.stringify(trainer.toState()));
  farm.close();
}

void main();
