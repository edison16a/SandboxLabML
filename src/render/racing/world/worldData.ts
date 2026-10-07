import type { Track } from '@/engine/racing/track/types';
import { stadiumLayout, type StadiumLayout } from '../stadium/layout';
import { placeFlora, type Flora } from './flora/placement';
import type { TerrainShape } from './terrain/terrainHeight';
import { buildTrackField, type TrackField } from './trackField';

/** Everything about a circuit's surroundings that only depends on the track: computed once, shared by every piece. */
export interface WorldData {
  track: Track;
  field: TrackField;
  layout: StadiumLayout;
  shape: TerrainShape;
  flora: Flora;
}

/** A few recent worlds, so switching Sandbox tracks back and forth costs nothing the second time. */
const cache = new Map<string, WorldData>();

/** The world for a track, built on first use. Pure and deterministic: the same track gets the same hills. */
export function worldFor(track: Track): WorldData {
  const key = `${track.hash}:${track.halfWidth}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const field = buildTrackField(track);
  const layout = stadiumLayout(track, field);
  const seed = (Number.parseInt(track.hash.slice(0, 8), 16) || 1) % 100000;
  const shape: TerrainShape = { field, pads: layout.pads, seed };
  const world: WorldData = { track, field, layout, shape, flora: placeFlora(shape) };
  cache.set(key, world);
  if (cache.size > 4) cache.delete(cache.keys().next().value as string);
  return world;
}
