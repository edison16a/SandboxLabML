import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';

/**
 * Who plays the test match. The test players are the fixed, hand-written
 * players lesson checks use, so the script's rewards show against sensible
 * play. Random brains are fresh networks for the script's blueprint, the
 * way a new run starts out.
 */
export type MatchBrains = 'test' | 'random';

export interface MatchTestRequest {
  source: string;
  layout: HideSeekLayoutId;
  brains: MatchBrains;
  /** Seeds where the players start, the box jitter, the script's rand() and the random brains. */
  seed: number;
}

export interface TickEvent {
  tick: number;
  text: string;
}

/** Per tick columns for both teams, as typed arrays so the worker can hand them over without copying. */
export interface MatchLog {
  time: Float32Array;
  hiderReward: Float32Array;
  seekerReward: Float32Array;
  hiderTotal: Float32Array;
  seekerTotal: Float32Array;
  /** Ticks where something happened, such as a sighting, a grab or the end of prep. */
  events: TickEvent[];
}

export interface MatchTestOk {
  ok: true;
  ticks: number;
  /** Ticks of prep at the start, while the seeker is frozen and blind. */
  prepTicks: number;
  log: MatchLog;
  layout: HideSeekLayoutId;
  brains: MatchBrains;
  blueprint: string;
  hiderTotal: number;
  seekerTotal: number;
  /** Shares of the seek phase the hider spent out of sight and in sight, 0 to 1. */
  hiddenShare: number;
  seenShare: number;
  locks: number;
  /** Grabs by both players together. */
  grabs: number;
  /** The script alone for one player, measured in a tight loop over states from this match. */
  scriptMicros: number;
  /** A whole match tick: physics, sight, rays, both brains and the script for both players. */
  tickMicros: number;
}

export type MatchTestResult = MatchTestOk | { ok: false; message: string };
