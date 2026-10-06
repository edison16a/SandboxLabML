import type { AgentController } from '../../env/types';
import type { Network } from '../../neat/network';
import type { Genome } from '../../neat/types';
import type { HideSeekAgent } from '../agents/agent';
import type { HideSeekInputConfig } from '../inputConfig';
import type { HideSeekLayoutId } from '../layouts/types';
import type { HideSeekPhysics } from '../physics';
import type { HideSeekRewardId } from '../rewards';

/** One side of a match, as plain data. */
export interface MatchTeamSpec {
  genome: Genome;
  inputs: HideSeekInputConfig;
  /**
   * Index of this genome in its team's current population, or -1 for an
   * opponent that only provides the challenge (a hall of fame champion, or
   * a current genome standing in for one). The trainer credits rewards to
   * slots that are not -1.
   */
  slot?: number;
}

/**
 * Everything needed to play a match exactly, as plain JSON, so it can be
 * posted to a worker and replayed later with the same result. Script
 * controllers are not data, so they are passed next to the spec.
 */
export interface MatchSpec {
  layout: HideSeekLayoutId;
  seed: number;
  hider: MatchTeamSpec;
  seeker: MatchTeamSpec;
  /** Built-in rewards for any team without a script controller. Defaults to v1. */
  reward?: HideSeekRewardId;
  /** Defaults to DEFAULT_HIDESEEK_PHYSICS. */
  physics?: HideSeekPhysics;
  /** Where the trainer scheduled it: round number and position in the round. */
  round?: number;
  index?: number;
}

/** Script controllers for one match. A missing team uses the spec's built-in rewards. */
export interface MatchControllers {
  hider?: AgentController<HideSeekAgent>;
  seeker?: AgentController<HideSeekAgent>;
}

/** Outcome of one match. Plain numbers, cheap to send back from a worker. */
export interface MatchResult {
  layout: HideSeekLayoutId;
  seed: number;
  /** Physics steps played. */
  ticks: number;
  hiderReward: number;
  seekerReward: number;
  /** Share of seek phase ticks the hider spent out of the seeker's sight, 0 to 1. */
  hiddenShare: number;
  /** Share of seek phase ticks the seeker had the hider in sight. Always 1 minus hiddenShare. */
  seenShare: number;
  /** Seconds into the seek phase of the first sighting, or -1 if the hider was never seen. */
  firstSeenAt: number;
  /** Locks the hider placed (each lock event, even if later unlocked). */
  locksPlaced: number;
  unlocks: number;
  /** Boxes still locked at the end. */
  lockedAtEnd: number;
  hiderGrabs: number;
  seekerGrabs: number;
  /** Boxes that ended more than half a meter from where they started. */
  boxesMoved: number;
  /** Meters traveled by all boxes together. */
  boxTravel: number;
  /** Why a controller stopped an agent, or null if it played to the end. */
  hiderStop: string | null;
  seekerStop: string | null;
}

/** One team ready to play: a compiled brain, what it senses and how it is rewarded. */
export interface HideSeekTeamSetup {
  brain: Network;
  inputs: HideSeekInputConfig;
  controller: AgentController<HideSeekAgent>;
}

/** What `HideSeekMatch` needs besides a world: the seed and both teams. */
export interface HideSeekMatchOptions {
  seed: number;
  hider: HideSeekTeamSetup;
  seeker: HideSeekTeamSetup;
}
