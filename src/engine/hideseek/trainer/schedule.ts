import { mixSeed, type Rng } from '../../core/rng';
import type { Genome } from '../../neat/types';
import type { HideSeekLayoutId } from '../layouts/types';
import type { MatchSpec, MatchTeamSpec } from '../match/types';
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

type RoundKind = 'current' | 'hallOfFame' | 'scripted';

/**
 * The room of match `index` in round `r`. Without mixLayouts it is one
 * room per round. With it, the last rounds are dealt like a Latin square,
 * match i of round r in room r + i, so each of those rounds covers every
 * room and every hider meets each room equally often. Rounds left over
 * when the count does not divide evenly come first and play one room
 * each, moving on every generation, so no genome gets an easier mix.
 */
function roomOf(o: ResolvedTrainerOptions, generation: number, r: number, index: number): HideSeekLayoutId {
  const L = o.layouts.length;
  if (!o.mixLayouts) return o.layouts[r % L];
  const leftover = o.rounds % L;
  return o.layouts[r < leftover ? (generation + r) % L : (r + index) % L];
}

/** The kind of round `r`: current rounds first, then hall of fame, then scripted. */
function kindOf(o: ResolvedTrainerOptions, r: number): RoundKind {
  const { current, hallOfFame } = o.opponents;
  return r < current ? 'current' : r < current + hallOfFame ? 'hallOfFame' : 'scripted';
}

/**
 * Plans one generation as rounds of match specs. Seeds are
 * mixSeed(run seed, generation, round, index) and the room is cycled by
 * round (see roomOf), so any match can be replayed on its own later.
 *
 * Current rounds pair hider i with seeker i in the first one and with a
 * seeded shuffle of the seekers after that. Both sides of those matches
 * count toward fitness.
 *
 * Hall of fame rounds, for both teams: match i pairs current hider i with
 * a past seeker champion, and match H + j pairs a past hider champion with
 * current seeker j. Only the current genome's reward counts there. With an
 * empty hall (the first generation) a random current opponent stands in.
 *
 * Scripted rounds have the same shape, with the scripted seeker and the
 * scripted hider as the opponents. They draw nothing from the Rng.
 *
 * Every genome plays exactly one scored match per round. When the teams
 * differ in size, current rounds wrap the smaller team so every genome of
 * the larger one still plays.
 */
export function planRounds(input: ScheduleInput): MatchSpec[][] {
  const { options: o, generation, hiders, seekers, hallOfFame, rng } = input;
  const H = hiders.length;
  const S = seekers.length;
  const rounds: MatchSpec[][] = [];
  for (let r = 0; r < o.rounds; r++) {
    const specs: MatchSpec[] = [];
    const add = (hider: MatchTeamSpec, seeker: MatchTeamSpec) => {
      const index = specs.length;
      const layout = roomOf(o, generation, r, index);
      const seed = o.sharedSeeds ? mixSeed(o.seed, generation, r) : mixSeed(o.seed, generation, r, index);
      specs.push({ layout, seed, hider, seeker, reward: o.reward, physics: o.physics, round: r, index });
      if (o.prepSeconds !== undefined) specs[index].prepSeconds = o.prepSeconds;
    };
    const hider = (genome: Genome, slot: number, scripted = false): MatchTeamSpec => team(genome, o.hiderInputs, slot, scripted);
    const seeker = (genome: Genome, slot: number, scripted = false): MatchTeamSpec => team(genome, o.seekerInputs, slot, scripted);
    const kind = kindOf(o, r);
    if (kind === 'current') {
      const order = Array.from({ length: S }, (_, j) => j);
      if (r > 0) rng.shuffle(order);
      for (let i = 0; i < Math.max(H, S); i++) add(hider(hiders[i % H], i % H), seeker(seekers[order[i % S]], order[i % S]));
    } else if (kind === 'hallOfFame') {
      for (let i = 0; i < H; i++) add(hider(hiders[i], i), seeker(hallOfFame.seekers.sample(rng) ?? seekers[rng.int(S)], -1));
      for (let j = 0; j < S; j++) add(hider(hallOfFame.hiders.sample(rng) ?? hiders[rng.int(H)], -1), seeker(seekers[j], j));
    } else {
      // The stand-in genomes only give the scripted agents a brain of the right shape.
      for (let i = 0; i < H; i++) add(hider(hiders[i], i), seeker(seekers[i % S], -1, true));
      for (let j = 0; j < S; j++) add(hider(hiders[j % H], -1, true), seeker(seekers[j], j));
    }
    rounds.push(specs);
  }
  return rounds;
}

function team(genome: Genome, inputs: MatchTeamSpec['inputs'], slot: number, scripted: boolean): MatchTeamSpec {
  return scripted ? { genome, inputs, slot, scripted } : { genome, inputs, slot };
}
