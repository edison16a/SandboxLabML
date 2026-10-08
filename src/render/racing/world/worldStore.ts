import * as THREE from 'three';
import type { Track } from '@/engine/racing/track/types';
import type { WorldReply, WorldRequest } from './world.worker';
import { worldFor, type WorldData } from './worldData';
import { assembleWorld, terrainArrays, type TerrainArrays } from './worldParts';

/** Worlds and terrain meshes that have arrived, by track key and by key and grid step. */
const worlds = new Map<string, WorldData>();
const terrains = new Map<string, THREE.BufferGeometry>();
const tracks = new Map<string, Track>();
const pendingWorld = new Set<string>();
const pendingTerrain = new Set<string>();
const listeners = new Set<() => void>();
/** Worlds kept, newest last: switching Sandbox tracks back and forth costs nothing the second time. */
const KEEP = 4;
let worker: Worker | null | undefined;

/** The key a track's world is stored under: its shape and its width. */
export function worldKey(track: Track): string {
  return `${track.hash}:${track.halfWidth}`;
}

function notify(): void {
  for (const fn of listeners) fn();
}

/** Calls `fn` whenever a world or terrain arrives. Returns the unsubscribe. */
export function subscribeWorlds(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function readWorld(track: Track): WorldData | null {
  return worlds.get(worldKey(track)) ?? null;
}

export function readTerrain(world: WorldData, step: number): THREE.BufferGeometry | null {
  return terrains.get(`${worldKey(world.track)}:${step}`) ?? null;
}

function geometryFrom(a: TerrainArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(a.color, 3));
  g.setAttribute('surface', new THREE.BufferAttribute(a.surface, 2));
  g.setIndex(new THREE.BufferAttribute(a.index, 1));
  g.computeBoundingSphere();
  return g;
}

/** Stores what arrived and drops the oldest world, with its terrain, once more than KEEP are held. */
function store(key: string, world: WorldData | null, step: number, terrain: TerrainArrays | null): void {
  if (world && !worlds.has(key)) worlds.set(key, world);
  if (terrain) terrains.set(`${key}:${step}`, geometryFrom(terrain));
  pendingWorld.delete(key);
  pendingTerrain.delete(`${key}:${step}`);
  while (worlds.size > KEEP) {
    const old = worlds.keys().next().value as string;
    worlds.delete(old);
    tracks.delete(old);
    for (const [k, g] of terrains) {
      if (!k.startsWith(`${old}:`)) continue;
      g.dispose();
      terrains.delete(k);
    }
  }
  notify();
}

/** The shared builder worker, started on first use; null where workers do not exist, which builds on this thread. */
function builder(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  worker = new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module', name: 'racing-world' });
  worker.onmessage = (e: MessageEvent<WorldReply>) => {
    const { key, step, parts, terrain } = e.data;
    const track = tracks.get(key);
    if (track) store(key, worlds.has(key) ? null : assembleWorld(track, parts), step, terrain);
  };
  return worker;
}

/**
 * Asks for a track's world and, with a `step`, its terrain at that grid
 * step. Each piece is built once; repeated asks while it is on its way do
 * nothing. Listeners hear when it lands.
 */
export function requestWorld(track: Track, step = 0): void {
  const key = worldKey(track);
  const needWorld = !worlds.has(key) && !pendingWorld.has(key);
  const id = `${key}:${step}`;
  const needTerrain = step > 0 && !terrains.has(id) && !pendingTerrain.has(id);
  if (!needWorld && !needTerrain) return;
  tracks.set(key, track);
  if (needWorld) pendingWorld.add(key);
  if (needTerrain) pendingTerrain.add(id);
  const w = builder();
  if (w) {
    w.postMessage({ key, spec: track.spec, step: needTerrain ? step : 0 } satisfies WorldRequest);
    return;
  }
  const world = worlds.get(key) ?? worldFor(track);
  store(key, world, step, needTerrain ? terrainArrays(world, step).arrays : null);
}
