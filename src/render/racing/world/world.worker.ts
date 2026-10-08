/// <reference lib="webworker" />
import { buildTrack } from '@/engine/racing/track/buildTrack';
import type { TrackSpec } from '@/engine/racing/track/types';
import { worldFor } from './worldData';
import { terrainArrays, worldParts, type TerrainArrays, type WorldParts } from './worldParts';

/** A request for a track's world and, optionally, its terrain at one grid step. */
export interface WorldRequest {
  key: string;
  spec: TrackSpec;
  /** Terrain grid step, m, or 0 for the world alone. */
  step: number;
}

export interface WorldReply {
  key: string;
  step: number;
  parts: WorldParts;
  terrain: TerrainArrays | null;
}

/**
 * Builds racing worlds off the main thread: the distance field, the hills,
 * every tree and the terrain mesh are pure math that takes a few hundred
 * milliseconds per track, which on the page's own thread would freeze a
 * Sandbox track switch or the landing page for a moment. The track is
 * rebuilt from its spec here; the same spec always gives the same track.
 */
self.onmessage = (e: MessageEvent<WorldRequest>) => {
  const { key, spec, step } = e.data;
  const world = worldFor(buildTrack(spec));
  const built = step > 0 ? terrainArrays(world, step) : null;
  const reply: WorldReply = { key, step, parts: worldParts(world), terrain: built?.arrays ?? null };
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(reply, built?.transfer ?? []);
};
