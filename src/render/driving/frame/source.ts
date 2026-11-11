/** One snapshot and when it arrived. */
export interface FrameBuffer {
  buffer: Float32Array;
  tick: number;
  at: number;
}

/**
 * What the city renderer reads from a stream of snapshots: the last two
 * frames for blending, how many agents, their tags (species or ghost
 * generation) and an epoch that changes whenever a new episode starts.
 * The workers' SnapshotStream has exactly this shape, and so does the
 * preview's main thread simulation, so the renderer has one code path.
 */
export interface FrameSource {
  prev: FrameBuffer | null;
  curr: FrameBuffer | null;
  count: number;
  tags: Int32Array;
  epoch: number;
  alpha(now?: number): number;
}
