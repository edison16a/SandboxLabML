import type { AnyEpisodeModule, EpisodeEnv } from '@/engine/env/episode';
import type { StreamSender } from '../shared/streamPort';
import { inspectAgent } from '../sim/frame';

/** One env of a ghost replay and, for each of its agents, the ghost's index in the stream. */
export interface GhostGroup {
  env: EpisodeEnv;
  order: number[];
}

/**
 * Writes ghost frames: several envs (one per script version) merged into
 * one stream in ghost order, then the world block. Ghosts share one world
 * (lights, traffic and movers follow only the setup and the tick), so the
 * first env's world stands for all of them.
 */
export class GhostFrames {
  private stride = 0;
  private outputs = 0;
  private world = 0;
  private count = 0;
  private scratch = new Float32Array(0);

  constructor(private readonly stream: StreamSender) {}

  /** Announces a new run of `generations.length` ghosts and sizes the buffers for it. */
  start(module: AnyEpisodeModule, groups: readonly GhostGroup[], generations: number[]): void {
    this.stride = module.snapshot.stride;
    this.outputs = module.outputs.length;
    this.world = groups[0]?.env.worldFloats ?? 0;
    this.count = generations.length;
    this.stream.ring.resize(this.count * this.stride + this.world);
    this.stream.send({ kind: 'start', stream: 'ghosts', generation: 0, count: this.count, tags: Int32Array.from(generations), world: this.world });
  }

  send(groups: readonly GhostGroup[]): void {
    const buffer = this.stream.ring.take();
    if (!buffer) return;
    const stride = this.stride;
    let tick = 0;
    for (const { env, order } of groups) {
      if (this.scratch.length < env.agentCount * stride) this.scratch = new Float32Array(env.agentCount * stride);
      const tmp = this.scratch;
      env.writeSnapshot(tmp, 0);
      order.forEach((ghostIndex, k) => buffer.set(tmp.subarray(k * stride, (k + 1) * stride), ghostIndex * stride));
      tick = Math.max(tick, env.tick);
    }
    if (this.world > 0) groups[0]?.env.writeWorld?.(buffer, this.count * stride);
    this.stream.send({ kind: 'frame', stream: 'ghosts', generation: 0, tick, count: this.count, buffer, inspect: this.inspected(groups) });
  }

  /** Observation and outputs of the inspected ghost, for the inputs overlay. */
  private inspected(groups: readonly GhostGroup[]) {
    const index = this.stream.inspect;
    if (index === null) return undefined;
    for (const { env, order } of groups) {
      const k = order.indexOf(index);
      if (k >= 0) return inspectAgent(env, k, this.outputs, index);
    }
    return undefined;
  }
}
