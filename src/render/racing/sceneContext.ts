import * as THREE from 'three';
import { createContext, useContext } from 'react';
import type { Track } from '@/engine/racing/track/types';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { tickMotion, type TickMotion } from './motion/tickMotion';
import { wheelContact, type WheelContact } from './motion/wheelContact';

/**
 * Per-frame facts several scene parts need: which car leads, where the
 * camera target is and how it moves. A driver component fills this in at the
 * start of every frame, and the cars, camera, shadows and overlays read it.
 */
export interface RacingFrame {
  leader: number;
  focusPos: THREE.Vector3;
  focusYaw: number;
  focusSpeed: number;
  /** Which stream and index the focus is on, for the inputs overlay. */
  focusStream: 'population' | 'ghosts' | null;
  focusIndex: number;
  /** Instance hidden from the instanced mesh because the detailed car draws it. */
  hiddenPopulation: number;
  hiddenGhost: number;
  /** Rays drawn by the inputs overlay this frame, reported to browser tests. */
  rayCount: number;
  /** The followed car's accelerations over its latest tick, read from the snapshots. */
  motion: TickMotion;
  /** What the followed car's tires touch this frame. */
  contact: WheelContact;
  /** Which car `contact` was last read for (stream and index in one number), so a switch resets its search. */
  contactOwner: number;
  /** Snapshot tick and car `motion` was read from, so it is worked out once per tick. */
  motionTick: number;
  motionIndex: number;
}

export function createFrame(): RacingFrame {
  return {
    leader: -1,
    focusPos: new THREE.Vector3(),
    focusYaw: 0,
    focusSpeed: 0,
    focusStream: null,
    focusIndex: -1,
    hiddenPopulation: -1,
    hiddenGhost: -1,
    rayCount: 0,
    motion: tickMotion(),
    contact: wheelContact(),
    contactOwner: -1,
    motionTick: -1,
    motionIndex: -1,
  };
}

export interface RacingSceneValue {
  track: Track;
  population: SnapshotStream | null;
  ghosts: SnapshotStream | null;
  frame: RacingFrame;
}

export const RacingSceneContext = createContext<RacingSceneValue | null>(null);

export function useRacingScene(): RacingSceneValue {
  const v = useContext(RacingSceneContext);
  if (!v) throw new Error('useRacingScene must be used inside RacingSceneContext');
  return v;
}
