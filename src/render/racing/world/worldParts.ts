import type { Track } from '@/engine/racing/track/types';
import type { StadiumLayout } from '../stadium/layout';
import type { Flora } from './flora/placement';
import { buildTerrainArrays, type TerrainArrays } from './terrain/terrainMesh';
import type { TrackField } from './trackField';
import type { WorldData } from './worldData';

/** Everything in a world except the track itself, as structured clone friendly data. */
export interface WorldParts {
  field: TrackField;
  layout: StadiumLayout;
  seed: number;
  flora: Flora;
  tufts: Float32Array;
}

/**
 * Splits a world into parts a worker can post back. They are copied, not
 * moved: the worker keeps the world cached, so a later request for another
 * terrain detail level needs its arrays intact.
 */
export function worldParts(world: WorldData): WorldParts {
  const { field, layout, shape, flora, tufts } = world;
  return { field, layout, seed: shape.seed, flora, tufts };
}

/** Puts a world back together on the main thread around the track it was built for. */
export function assembleWorld(track: Track, parts: WorldParts): WorldData {
  const { field, layout, seed, flora, tufts } = parts;
  return { track, field, layout, shape: { field, pads: layout.pads, seed }, flora, tufts };
}

/** Builds the terrain for a world at one grid step and hands back its arrays and their buffers to move. */
export function terrainArrays(world: WorldData, step: number): { arrays: TerrainArrays; transfer: ArrayBuffer[] } {
  const arrays = buildTerrainArrays(world.shape, world.flora, step);
  return { arrays, transfer: Object.values(arrays).map((a) => a.buffer as ArrayBuffer) };
}

export type { TerrainArrays };
