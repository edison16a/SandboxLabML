import { requireEpisodeModule } from '../../env/registry';
import { lessonRunConfig, lessonsOf, loadTestEpisode, type PreparedWithBrain } from '../episode/run';
import type { EpisodePreview, PreviewRay } from './types';

/** Longest preview kept, s. Lesson test episodes are a few seconds; this only stops a script that never ends. */
const MAX_SECONDS = 120;

/**
 * Records the lesson test episode of an env added through the registry,
 * tick by tick: the agent's snapshot, the world block, its rays and its
 * total reward, plus the still scene from the env's preview hook. It is
 * the episode a check runs, so what the learner watches is what gets
 * checked.
 */
export async function recordEpisodePreview(p: PreparedWithBrain): Promise<EpisodePreview> {
  const env = await loadTestEpisode(p);
  const envModule = requireEpisodeModule(p.env);
  const hook = lessonsOf(p.env).preview;
  const scene = hook ? hook.scene(env) : null;
  const bounds = hook?.bounds ? hook.bounds(env) : null;
  const rays = previewRays(p, env.raysPerAgent);
  const stride = envModule.snapshot.stride;
  const cap = Math.ceil(MAX_SECONDS * envModule.tickHz);
  const frames: number[] = [];
  const world: number[] = [];
  const reach: number[] = [];
  const rewards: number[] = [];
  const snap = new Float32Array(stride);
  const block = new Float32Array(env.worldFloats);
  const rayOut = new Float32Array(env.raysPerAgent);
  while (!env.done && rewards.length < cap) {
    env.step();
    env.writeSnapshot(snap, 0);
    for (const v of snap) frames.push(v);
    if (env.worldFloats > 0 && env.writeWorld) {
      env.writeWorld(block, 0);
      for (const v of block) world.push(v);
    }
    if (rays.length > 0 && env.writeRays) {
      env.writeRays(0, rayOut, 0);
      for (const v of rayOut) reach.push(v);
    }
    rewards.push(env.results()[0].fitness);
  }
  return {
    kind: 'episode',
    env: p.env,
    tickHz: envModule.tickHz,
    ticks: rewards.length,
    fields: envModule.snapshot.fields,
    frames: Float32Array.from(frames),
    worldFloats: world.length > 0 ? env.worldFloats : 0,
    world: Float32Array.from(world),
    rays,
    reach: Float32Array.from(reach),
    rewards: Float32Array.from(rewards),
    stopReason: env.results()[0].stopReason ?? 'time',
    scene,
    bounds,
  };
}

/**
 * The rays the overlay draws, from the input schema: every ray input in
 * observation order. When the env reports a different count, the preview
 * leaves the rays out rather than draw them at the wrong angles.
 */
function previewRays(p: PreparedWithBrain, count: number): PreviewRay[] {
  if (count === 0) return [];
  const schema = requireEpisodeModule(p.env).inputSchema(lessonRunConfig(p), p.script.sensors);
  const rays = schema.flatMap((s) => (s.ray ? [{ angle: s.ray.angle, maxLength: s.ray.maxLength }] : []));
  return rays.length === count ? rays : [];
}
