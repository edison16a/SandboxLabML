/**
 * Fixed yardsticks for a co-evolution run. Co-evolved numbers can stay flat
 * while both teams improve, because each team's opponents improve too. So
 * every genome of a team also plays hand-written opponents that never
 * change, on seeds that never change, and the mean share is compared over
 * time with its standard error.
 */
import { mixSeed } from '../../src/engine/core/rng';
import { HIDESEEK_LAYOUT_IDS, type HideSeekTrainer, type MatchSpec } from '../../src/engine/hideseek';
import type { Farm, Job } from './farm';

/** Who a team plays: the scripted seeker or hider, or the held-out scanner seeker (hiders only). */
export type Yardstick = 'scripted' | 'heldOut';

/** A population mean with its standard error, taking genomes as the samples. */
export interface Measure {
  mean: number;
  se: number;
  genomes: number;
  matches: number;
}

/** Mean and standard error of per-genome means. */
export function measure(perGenome: number[][]): Measure {
  const means = perGenome.map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
  const n = means.length;
  const mean = means.reduce((a, b) => a + b, 0) / n;
  const variance = means.reduce((a, m) => a + (m - mean) ** 2, 0) / Math.max(1, n - 1);
  return { mean, se: Math.sqrt(variance / n), genomes: n, matches: perGenome.reduce((a, xs) => a + xs.length, 0) };
}

/** How many standard errors `after` is above `before`. */
export function zScore(before: Measure, after: Measure): number {
  const se = Math.hypot(before.se, after.se);
  return se > 0 ? (after.mean - before.mean) / se : 0;
}

export function formatMeasure(m: Measure): string {
  return `${m.mean.toFixed(3)} ± ${m.se.toFixed(3)}`;
}

/**
 * Every genome of `team` plays `perGenome` matches against a fixed
 * opponent. Match k of genome i is always in room k (cycling through all
 * rooms, whatever the run trains in) with seed mixSeed(0xbe7c, k, i), and
 * with the standard prep phase, so two runs or two checkpoints play the
 * very same matches.
 */
export function yardstickJobs(trainer: HideSeekTrainer, team: 'hiders' | 'seekers', against: Yardstick, perGenome: number, script?: string): Job[] {
  const o = trainer.options;
  const hiders = trainer.hiders.genomes;
  const seekers = trainer.seekers.genomes;
  const own = team === 'hiders' ? hiders : seekers;
  const jobs: Job[] = [];
  own.forEach((genome, i) => {
    for (let k = 0; k < perGenome; k++) {
      const spec: MatchSpec = {
        layout: HIDESEEK_LAYOUT_IDS[k % HIDESEEK_LAYOUT_IDS.length],
        seed: mixSeed(0xbe7c, k, i),
        hider: team === 'hiders' ? { genome, inputs: o.hiderInputs, slot: i } : { genome: hiders[0], inputs: o.hiderInputs, scripted: true },
        seeker: team === 'seekers' ? { genome, inputs: o.seekerInputs, slot: i } : { genome: seekers[0], inputs: o.seekerInputs, scripted: against === 'scripted' },
        reward: o.reward,
        physics: o.physics,
      };
      jobs.push({ spec, heldOut: team === 'hiders' && against === 'heldOut', script });
    }
  });
  return jobs;
}

/** Hidden share for hiders, seen share for seekers, measured over the whole current population. */
export async function benchmark(farm: Farm, trainer: HideSeekTrainer, team: 'hiders' | 'seekers', against: Yardstick, perGenome: number, script?: string): Promise<Measure> {
  const results = await farm.run(yardstickJobs(trainer, team, against, perGenome, script));
  const per: number[][] = [];
  results.forEach((r, k) => {
    const i = Math.floor(k / perGenome);
    (per[i] ??= []).push(team === 'hiders' ? r.hiddenShare : r.seenShare);
  });
  return measure(per);
}

/** The three yardsticks the measurement script tracks. */
export interface Yardsticks {
  hidersVsScripted: Measure;
  hidersVsHeldOut: Measure;
  seekersVsScripted: Measure;
}

export async function allYardsticks(farm: Farm, trainer: HideSeekTrainer, perGenome: number, script?: string): Promise<Yardsticks> {
  return {
    hidersVsScripted: await benchmark(farm, trainer, 'hiders', 'scripted', perGenome, script),
    hidersVsHeldOut: await benchmark(farm, trainer, 'hiders', 'heldOut', perGenome, script),
    seekersVsScripted: await benchmark(farm, trainer, 'seekers', 'scripted', perGenome, script),
  };
}
