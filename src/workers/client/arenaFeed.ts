import type { InspectPayload, StreamOut } from '../shared/protocol';

/** One complete frame of every arena, with when it arrived on the main thread. */
export interface ArenaFrame {
  buffer: Float32Array;
  tick: number;
  at: number;
}

/**
 * What the Hide and Seek renderer reads arenas from. Both the merged live
 * stream and the replay worker's plain snapshot stream fit this shape, so
 * the grid and the showcase do not care where the arenas come from.
 */
export interface ArenaFeed {
  readonly prev: ArenaFrame | null;
  readonly curr: ArenaFrame | null;
  readonly count: number;
  readonly generation: number;
  /** Layout index per arena (see HIDESEEK_LAYOUT_IDS). */
  readonly tags: Int32Array;
  /** Inputs and outputs of the inspected agent, addressed as arena * 2 + agent. */
  readonly inspect: InspectPayload | null;
  /** Ray hit points, 64 floats per arena, when subscribed. */
  readonly rays: Float32Array | null;
  /** Bumped whenever a new episode starts, so renderers can reset per-arena state. */
  readonly epoch: number;
  alpha(now?: number): number;
  subscribe(inspect: number | null, rays: boolean): void;
  on(fn: (msg: StreamOut) => void): () => void;
}
