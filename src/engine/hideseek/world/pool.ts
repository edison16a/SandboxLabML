import { hashObject } from '../../core/hash';
import type { ArenaLayout } from '../layouts/types';
import { hideSeekPhysicsHash, type HideSeekPhysics } from '../physics';
import { ArenaWorld } from './arena';
import { loadRapier, type Rapier } from './rapier';

const layoutKeys = new WeakMap<ArenaLayout, string>();
const physicsKeys = new WeakMap<HideSeekPhysics, string>();

/** Hashes are cached per object, so acquiring a world costs a map lookup, not a hash. */
function keyOf(layout: ArenaLayout, physics: HideSeekPhysics): string {
  let l = layoutKeys.get(layout);
  if (!l) layoutKeys.set(layout, (l = hashObject(layout)));
  let p = physicsKeys.get(physics);
  if (!p) physicsKeys.set(physics, (p = hideSeekPhysicsHash(physics)));
  return `${layout.id}:${l}:${p}`;
}

/**
 * Arena slots, one per running match. A slot owns one live Rapier world at
 * a time and frees it before building the next (see ArenaWorld.reset), and
 * the pool owns every slot, so no world is ever left unfreed: the WASM heap
 * stays flat however many matches a worker plays. A worker keeps one pool
 * for its whole life and disposes it when it shuts down.
 */
export class ArenaPool {
  readonly rapier: Rapier;
  private readonly idle = new Map<string, ArenaWorld[]>();
  private readonly keys = new Map<ArenaWorld, string>();
  private disposed = false;

  constructor(rapier: Rapier) {
    this.rapier = rapier;
  }

  /** An idle slot for this room and rules, built if none is free. The caller resets it. */
  acquire(layout: ArenaLayout, physics: HideSeekPhysics): ArenaWorld {
    if (this.disposed) throw new Error('This arena pool has been disposed.');
    const key = keyOf(layout, physics);
    const reuse = this.idle.get(key)?.pop();
    if (reuse) return reuse;
    const arena = new ArenaWorld(this.rapier, layout, physics);
    this.keys.set(arena, key);
    return arena;
  }

  /** Returns a slot for reuse. Releasing twice is a no-op. */
  release(arena: ArenaWorld): void {
    const key = this.keys.get(arena);
    if (!key || this.disposed) return;
    let list = this.idle.get(key);
    if (!list) this.idle.set(key, (list = []));
    if (!list.includes(arena)) list.push(arena);
  }

  /** Slots built so far, in use or idle. Stops growing once every concurrent match has one. */
  get size(): number {
    return this.keys.size;
  }

  /** Frees the live world of every slot, including slots still in use. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const arena of this.keys.keys()) arena.dispose();
    this.keys.clear();
    this.idle.clear();
  }
}

/** Loads Rapier and returns an empty pool. */
export async function createArenaPool(): Promise<ArenaPool> {
  return new ArenaPool(await loadRapier());
}
