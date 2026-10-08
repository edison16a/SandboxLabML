'use client';

import type * as THREE from 'three';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { Track } from '@/engine/racing/track/types';
import type { WorldData } from './worldData';
import { readTerrain, readWorld, requestWorld, subscribeWorlds } from './worldStore';

/**
 * A track's world, or null while a worker builds it (or while `track` is
 * null, as when a track is being drawn). With a `step` the terrain at that
 * grid step is asked for in the same trip. Every scene part that calls
 * this for the same track gets the same world object.
 */
export function useWorld(track: Track | null, step = 0): WorldData | null {
  const snapshot = useCallback(() => (track ? readWorld(track) : null), [track]);
  const world = useSyncExternalStore(subscribeWorlds, snapshot, () => null);
  useEffect(() => {
    if (track) requestWorld(track, step);
  }, [track, step]);
  return world;
}

/** The terrain mesh of a world at a grid step, or null until it arrives. The cache owns the geometry. */
export function useTerrain(world: WorldData, step: number): THREE.BufferGeometry | null {
  const snapshot = useCallback(() => readTerrain(world, step), [world, step]);
  const geometry = useSyncExternalStore(subscribeWorlds, snapshot, () => null);
  useEffect(() => requestWorld(world.track, step), [world, step]);
  // The cache keeps the arrays; leaving the scene only frees the GPU copy, and three uploads it again on return.
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}
