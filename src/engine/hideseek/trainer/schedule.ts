import { mixSeed, type Rng } from '../../core/rng';
import type { Genome } from '../../neat/types';
import type { MatchSpec } from '../match/types';
import type { HallOfFame } from './hallOfFame';
import type { ResolvedTrainerOptions } from './types';

/** What one generation's schedule is built from. */
export interface ScheduleInput {
  options: ResolvedTrainerOptions;
  generation: number;
  hiders: Genome[];
  seekers: Genome[];
  hallOfFame: { hiders: HallOfFame; seekers: HallOfFame };
  /** The run Rng. Shuffles and hall of fame picks draw from it, in a fixed order. */
  rng: Rng;
}

/**
 * Plans one generation as rounds of match specs. Seeds are
 * mixSeed(run seed, generation, round, index) and the room is cycled by
 * round, so any match can be replayed on its own later.
 *
 * Round 1 pairs hider i with seeker i. Round 2 pairs hider i with a seeded
 * shuffle of the seekers. Both sides of those matches count toward fitness.
 *
 * Rounds 3 and 4 bring in the hall of fame, for both teams: match i pairs
 * current hider i with a past seeker champion, and match H + j pairs a past
 * hider champion with current seeker j. Only the current genome's reward
 * counts there, so every genome plays exactly four scored matches. With an
 * empty hall (the first generation) a random current opponent stands in.
 *
 * When the teams differ in size, rounds 1 and 2 wrap the smaller team so
 * every genome of the larger one still plays.
 */
export function planRounds(input: ScheduleInput): MatchSpec[][] {
  const { options: o, generation, hiders, seekers, hallOfFame, rng } = input;
  const H = hiders.length;
  const S = seekers.length;
  const rounds: MatchSpec[][] = [];
  for (let r = 0; r < o.rounds; r++) {
    const layout = o.layouts[r % o.layouts.length];
    const specs: MatchSpec[] = [];
    const add = (hider: Genome, hiderSlot: number, seeker: Genome, seekerSlot: number) => {
      const index = specs.length;
      specs.push({
        layout,
        seed: mixSeed(o.seed, generation, r, index),
        hider: { genome: hider, inputs: o.hiderInputs, slot: hiderSlot },
        seeker: { genome: seeker, inputs: o.seekerInputs, slot: seekerSlot },
        reward: o.reward,
        physics: o.physics,
        round: r,
        index,
      });
    };
    if (r < 2) {
      const order = Array.from({ length: S }, (_, j) => j);
      if (r === 1) rng.shuffle(order);
      for (let i = 0; i < Math.max(H, S); i++) add(hiders[i % H], i % H, seekers[order[i % S]], order[i % S]);
    } else {
      for (let i = 0; i < H; i++) add(hiders[i], i, hallOfFame.seekers.sample(rng) ?? seekers[rng.int(S)], -1);
      for (let j = 0; j < S; j++) add(hallOfFame.hiders.sample(rng) ?? hiders[rng.int(H)], -1, seekers[j], j);
    }
    rounds.push(specs);
  }
  return rounds;
}
