import type { AgentController } from '../../env/types';
import type { HideSeekAgent } from '../../hideseek/agents/agent';
import type { HideSeekInputConfig } from '../../hideseek/inputConfig';
import type { HideSeekLayoutId } from '../../hideseek/layouts/types';
import type { Genome } from '../../neat/types';
import type { ReferenceTier } from '../types';

/**
 * A Hide and Seek model: the hider and seeker champions of one generation.
 * The game has two roles, so the benchmark scores the pair together.
 */
export interface HideSeekModel {
  hider: Genome;
  seeker: Genome;
}

/**
 * One brain ready for the exam: the genome, what it senses and, when its
 * script adds sensors, a way to build that script's controller for a match
 * seed. Each team carries its own inputs, so brains of any shape can meet.
 */
export interface ExamTeam {
  genome: Genome;
  inputs: HideSeekInputConfig;
  /** Only the controller's sensors are used. Null when the brain has no script sensors. */
  sensors: ((seed: number) => AgentController<HideSeekAgent>) | null;
}

/** Both roles of one player in the exam: the model being scored or a reference opponent. */
export interface ExamSide {
  hider: ExamTeam;
  seeker: ExamTeam;
}

/** A reference champion pair as an exam opponent, with its rating from the reference file. */
export interface ExamOpponent {
  tier: ReferenceTier;
  side: ExamSide;
  rating: number;
}

/** Where a game starts: a room and a seed, which fix the spawn spots and the box jitter. */
export interface ExamStart {
  layout: HideSeekLayoutId;
  seed: number;
}

/**
 * One game against one opponent from one start. The model hides in the
 * first leg and seeks in the second, and both legs start from the same
 * spots, so the game is fair whichever role is easier in that room.
 */
export interface GameResult {
  opponent: ReferenceTier;
  layout: HideSeekLayoutId;
  seed: number;
  /** First leg: share of the seek phase the model's hider stayed out of sight. */
  hidden: number;
  /** First leg: share of the seek phase the model's hider was covered (see HideSeekAgent.exposed). */
  covered: number;
  /** First leg: boxes the model's hider locked. */
  locks: number;
  /** Second leg: share of the seek phase the model's seeker had the opponent's hider in sight. */
  seen: number;
}
