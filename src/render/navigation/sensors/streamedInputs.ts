import { RAY_MOVER, RAY_NONE, RAY_SOLID, RAY_SPIKES } from '@/engine/navigation/agent';
import type { RayHit } from '@/engine/navigation/sensors/raycast';

/** Most inputs kept, well past any Navigation brain (MAX_INPUTS is 128). */
const MAX = 160;
/** A ray this close to its full range met nothing, m. */
const OPEN = 0.05;

/**
 * The followed runner's inputs as its brain received them, kept from the
 * last two stream frames so a value can be blended between ticks like the
 * runner's pose. Distances come first in the observation, then (with hit
 * types) a spikes flag and a mover flag per ray, then the finish bearing:
 * the engine's schema order. Copies into fixed arrays, so nothing is
 * allocated per frame.
 */
export class StreamedInputs {
  private readonly prev = new Float32Array(MAX);
  private readonly curr = new Float32Array(MAX);
  private seen: ArrayLike<number> | null = null;
  private index = -1;
  private hasPrev = false;

  /**
   * Takes the feed's inspected observation if it belongs to agent `index`
   * and holds at least `need` values. Returns whether there is one to draw.
   */
  take(inspect: { index: number; obs: ArrayLike<number> } | null | undefined, index: number, need: number): boolean {
    if (!inspect || inspect.index !== index || inspect.obs.length < need) {
      this.seen = null;
      this.index = -1;
      return false;
    }
    if (inspect.obs !== this.seen) {
      // A new frame: the old latest becomes the one to blend from, unless the view just moved to this runner.
      this.hasPrev = this.seen !== null && this.index === index;
      if (this.hasPrev) this.prev.set(this.curr);
      const n = Math.min(MAX, inspect.obs.length);
      for (let k = 0; k < n; k++) this.curr[k] = inspect.obs[k];
      this.seen = inspect.obs;
      this.index = index;
    }
    return true;
  }

  /** Input k blended from the frame before to the latest, by `alpha`. */
  value(k: number, alpha: number): number {
    return this.hasPrev ? this.prev[k] + (this.curr[k] - this.prev[k]) * alpha : this.curr[k];
  }

  /** Ray r of n as a hit: its blended distance (m) and what it met, by the brain's own flags. */
  ray(r: number, n: number, range: number, hitTypes: boolean, alpha: number, out: RayHit): void {
    const d = Math.max(0, Math.min(range, this.value(r, alpha) * range));
    out.distance = d;
    if (hitTypes && this.curr[n + r] > 0.5) out.kind = RAY_SPIKES;
    else if (hitTypes && this.curr[2 * n + r] > 0.5) out.kind = RAY_MOVER;
    else out.kind = d < range - OPEN ? RAY_SOLID : RAY_NONE;
  }
}
