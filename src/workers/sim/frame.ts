import type { EpisodeEnv } from '@/engine/env/episode';
import type { InspectPayload } from '../shared/protocol';
import type { StreamSender } from '../shared/streamPort';

/**
 * Observation and outputs of one agent for the inputs panel. Copies are
 * made because the buffers travel to the main thread. Only the inspected
 * agent pays for this, so a frame stays under a kilobyte of extras.
 */
export function inspectAgent(env: EpisodeEnv, index: number, outputs: number, reported = index): InspectPayload {
  const out = new Float32Array(outputs);
  env.writeOutputs(index, out);
  return { index: reported, obs: Float32Array.from(env.lastObservation(index)), out };
}

/** Every agent's rays as fractions of their range, for the "all agents" overlay. */
export function allRays(env: EpisodeEnv): Float32Array | undefined {
  const per = env.raysPerAgent;
  if (per === 0 || !env.writeRays) return undefined;
  const rays = new Float32Array(env.agentCount * per);
  for (let k = 0; k < env.agentCount; k++) env.writeRays(k, rays, k * per);
  return rays;
}

/**
 * Sends one population frame: every agent's snapshot, then the env's world
 * block. Drops the frame when the main thread still holds every buffer, so
 * a slow tab never makes the queue grow.
 */
export function writeFrame(env: EpisodeEnv, stride: number, outputs: number, stream: StreamSender, generation: number): void {
  const buffer = stream.ring.take();
  if (!buffer) return;
  env.writeSnapshot(buffer, 0);
  if (env.worldFloats > 0) env.writeWorld?.(buffer, env.agentCount * stride);
  // -1 means "whoever leads", so the overlay can follow the champion without a round trip.
  const i = stream.inspect === -1 ? env.leaderIndex() : stream.inspect;
  const inspect = i !== null && i >= 0 && i < env.agentCount ? inspectAgent(env, i, outputs) : undefined;
  const rays = stream.rays ? allRays(env) : undefined;
  stream.send({ kind: 'frame', stream: 'population', generation, tick: env.tick, count: env.agentCount, buffer, inspect, rays });
}
