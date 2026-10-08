import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { vertexNormals } from './terrain/terrainMesh';
import { buildTerrainGrid } from './terrain/terrainGrid';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { worldFor } from './worldData';
import { assembleWorld, worldParts } from './worldParts';
import { readTerrain, readWorld, requestWorld, subscribeWorlds } from './worldStore';

describe('building the world off the main thread', () => {
  it('rebuilds the same world from the parts a worker posts back', () => {
    const track = buildTrack(BUILT_IN_TRACKS[2]);
    const world = worldFor(track);
    // Structured clone is what the worker message does to the parts.
    const back = assembleWorld(track, structuredClone(worldParts(world)));
    expect(back.layout).toEqual(world.layout);
    expect(Array.from(back.flora.pines.slice(0, 24))).toEqual(Array.from(world.flora.pines.slice(0, 24)));
    expect(back.field.dist.length).toBe(world.field.dist.length);
    expect(back.shape.pads).toEqual(world.shape.pads);
  });

  it('serves the world and its terrain once built, and tells listeners', () => {
    const track = buildTrack(BUILT_IN_TRACKS[0]);
    let heard = 0;
    const stop = subscribeWorlds(() => heard++);
    expect(readWorld(track)).toBeNull();
    // Node has no Worker, so the store builds on this thread.
    requestWorld(track, 6);
    stop();
    const world = readWorld(track);
    expect(world).not.toBeNull();
    expect(heard).toBeGreaterThan(0);
    expect(readTerrain(world!, 6)?.attributes.position.count).toBeGreaterThan(1000);
    expect(readTerrain(world!, 3)).toBeNull();
  });

  it('works out the same smooth normals as three, without three', () => {
    const world = worldFor(buildTrack(BUILT_IN_TRACKS[1]));
    const grid = buildTerrainGrid(world.shape, 6);
    const ours = vertexNormals(grid.position, grid.index);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(grid.position, 3));
    g.setIndex(new THREE.BufferAttribute(grid.index, 1));
    g.computeVertexNormals();
    const theirs = g.attributes.normal.array as Float32Array;
    let worst = 0;
    for (let i = 0; i < ours.length; i++) worst = Math.max(worst, Math.abs(ours[i] - theirs[i]));
    expect(worst).toBeLessThan(1e-4);
  });
});
