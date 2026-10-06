import type { HideSeekInputConfig } from '../../hideseek/inputConfig';
import { base64ToBytes, bytesToBase64, decodeGenome, encodeGenome } from '../../neat/serialize';
import type { Genome } from '../../neat/types';
import { REFERENCE_TIERS } from '../references';
import type { BenchReferences, ReferenceBrain, ReferenceChampion, ReferenceTier } from '../types';
import { checkTeam } from './side';
import type { ExamOpponent, ExamTeam } from './types';

/** A shipped brain as an exam team. Reference presets add no script sensors. */
function teamOf(role: 'hider' | 'seeker', brain: ReferenceBrain): ExamTeam {
  const genome = decodeGenome(base64ToBytes(brain.genome));
  checkTeam(role, genome, brain.inputs, 0);
  return { genome, inputs: brain.inputs, sensors: null };
}

/** One shipped champion pair as an opponent. */
export function opponentOf(c: ReferenceChampion): ExamOpponent {
  return { tier: c.tier, side: { hider: teamOf('hider', c.hider), seeker: teamOf('seeker', c.seeker) }, rating: c.rating };
}

/**
 * The exam's opponents from a reference file, Beginner first. Throws when
 * the file has no champions, because without them there is nothing to
 * play against.
 */
export function opponentsFrom(refs: BenchReferences): ExamOpponent[] {
  const champions = refs.env === 'hideseek' ? (refs.champions ?? []) : [];
  const out = REFERENCE_TIERS.flatMap((tier) =>
    champions
      .filter((c) => c.tier === tier)
      .slice(0, 1)
      .map(opponentOf),
  );
  if (out.length === 0) throw new Error('The reference file has no Hide and Seek champions to play against.');
  return out;
}

/** What the generator knows about a champion pair before it is written to the reference file. */
export interface ChampionPair {
  tier: ReferenceTier;
  seed: number;
  generation: number;
  rating: number;
  hider: { genome: Genome; inputs: HideSeekInputConfig };
  seeker: { genome: Genome; inputs: HideSeekInputConfig };
}

/**
 * A champion pair as stored in the reference file: genomes in the binary
 * format as base64, which round trips exactly, so the shipped opponents
 * play the very same matches the generator played.
 */
export function encodeChampion(c: ChampionPair): ReferenceChampion {
  const brain = (b: ChampionPair['hider']): ReferenceBrain => ({ inputs: b.inputs, genome: bytesToBase64(encodeGenome(b.genome)) });
  return { tier: c.tier, seed: c.seed, generation: c.generation, rating: c.rating, hider: brain(c.hider), seeker: brain(c.seeker) };
}
