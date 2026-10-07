import { createContext, useContext } from 'react';
import type { InputSpec } from '@/engine/env/types';
import type { ArenaFeed } from '@/workers/client/arenaFeed';
import { latticeFor, type Lattice } from '../layout/gridLattice';
import type { AgentPose } from './snapshotRead';

/**
 * Reads where agent slot `agent` (0 hider, 1 seeker) of the shown arena
 * stands and how high, blended, and returns its flags, or -1 when there is
 * none.
 */
export type AgentPoseReader = (agent: number, out: AgentPose) => number;

/**
 * What every part of the Hide and Seek scene needs to know this frame. The
 * frame driver fills it in first thing each frame from the active feed and
 * the lab store; the grid, the showcase and the overlays only read it.
 */
export interface HsFrame {
  feed: ArenaFeed | null;
  curr: Float32Array | null;
  prev: Float32Array | null;
  /** Blend from prev to curr, 0 to 1. */
  alpha: number;
  /** Arenas drawn, and the first arena of the feed they start at (the showcase alone may start anywhere). */
  count: number;
  first: number;
  lattice: Lattice;
  /** Layout index per drawn slot. */
  layouts: Int32Array;
  /** Slot drawn by the showcase, or -1. Grid instances of that slot are hidden. */
  focusSlot: number;
  /** Brightness of the slots outside the showcase: 1, or 0.8 while one arena is focused. */
  dim: number;
  /** Changes whenever the slots, lattice or layouts change, so static instances rebuild only then. */
  version: number;
  epoch: number;
  /** Seconds of match time of the first drawn arena, and whether it is in prep. */
  matchTime: number;
  prep: boolean;
  /** The feed is a still preview, not a stream: nothing has been sent yet. */
  preview: boolean;
  /**
   * Set by a scene whose stream is not laid out as arenas (the Sandbox), so
   * the first person cameras and the inspected agent's rays know where to
   * look. Null reads the arena snapshot (see followedAgent).
   */
  agentPose: AgentPoseReader | null;
}

export function createHsFrame(): HsFrame {
  return {
    feed: null,
    curr: null,
    prev: null,
    alpha: 1,
    count: 0,
    first: 0,
    lattice: latticeFor(1, 1),
    layouts: new Int32Array(0),
    focusSlot: -1,
    dim: 1,
    version: 0,
    epoch: 0,
    matchTime: 0,
    prep: true,
    preview: true,
    agentPose: null,
  };
}

export interface HsSceneValue {
  frame: HsFrame;
  /** The feed the session wants shown, or null before the workers are up. */
  getFeed: () => ArenaFeed | null;
  /** Input schemas of both teams, hider first, for the inputs overlay. */
  schemas: [InputSpec[], InputSpec[]];
  /** Sandbox edits, wired to the replay worker. Absent outside the lab. */
  onMoveBox?: (index: number, x: number, z: number) => void;
  onToggleLock?: (index: number, locked: boolean) => void;
}

export const HsSceneContext = createContext<HsSceneValue | null>(null);

export function useHsScene(): HsSceneValue {
  const v = useContext(HsSceneContext);
  if (!v) throw new Error('useHsScene must be used inside HsSceneContext');
  return v;
}
