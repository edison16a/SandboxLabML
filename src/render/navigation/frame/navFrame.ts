import type { Course } from '@/engine/navigation/course/build';
import { MAX_MOVERS } from '@/engine/navigation/snapshot';
import type { NavFeed } from '../types';

/** A blended pose on the floor. */
export interface FloorPose {
  x: number;
  z: number;
  yaw: number;
}

/**
 * What every part of the Navigation scene needs to know this frame. The
 * frame driver fills it first thing each frame from the feed; the course,
 * the crowd, the overlays and the camera only read it.
 */
export interface NavFrame {
  feed: NavFeed | null;
  course: Course | null;
  /** Bumped whenever the course changes, so static meshes rebuild only then. */
  courseVersion: number;
  curr: Float32Array | null;
  prev: Float32Array | null;
  alpha: number;
  count: number;
  epoch: number;
  timeScale: number;
  /** Episode clock, blended between snapshots, s. */
  time: number;
  /**
   * Simulation seconds since the last frame: 0 while the run is paused or
   * a new episode starts. Animations step on it, so they freeze with the
   * simulation and keep pace with it at any speed.
   */
  simDt: number;
  /** Where each mover stands this frame, blended: x, z per mover. */
  movers: Float32Array;
  /** The agent the champion character and the follow camera show, or -1. */
  leader: number;
  leaderPose: FloorPose;
  /** Bumped when the followed agent changes, so the champion character knows it jumped to someone else. */
  leaderVersion: number;
}

export function createNavFrame(): NavFrame {
  return {
    feed: null,
    course: null,
    courseVersion: 0,
    curr: null,
    prev: null,
    alpha: 1,
    count: 0,
    epoch: 0,
    timeScale: 1,
    time: 0,
    simDt: 0,
    movers: new Float32Array(MAX_MOVERS * 2),
    leader: -1,
    leaderPose: { x: 0, z: 0, yaw: 0 },
    leaderVersion: 0,
  };
}
