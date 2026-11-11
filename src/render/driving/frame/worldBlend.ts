import { lerpAngle } from '@/engine/core/math';
import { readWorld } from '@/engine/driving/snapshot';
import { createWorldState, type WorldState } from '@/engine/driving/world/state';
import type { FrameSource } from './source';

/** A car or person that moved further than this between two snapshots was put somewhere new: no blending. */
const JUMP = 8;

/**
 * Turns the world stream into a smooth world for this display frame. Both
 * snapshots are decoded once each (when they arrive) and every frame blends
 * positions and headings between them, so traffic and people glide at 60
 * frames per second from a 30 Hz simulation. Lights switch on the newer
 * snapshot only: a lamp should never be half red.
 */
export class WorldBlend {
  readonly a: WorldState;
  readonly b: WorldState;
  readonly out: WorldState;
  private aTick = -1;
  private bTick = -1;
  /** A new episode can start on the tick the last one was read at, so the epoch guards the cache too. */
  private epoch = -1;
  ready = false;

  constructor(signals: number) {
    this.a = createWorldState(signals);
    this.b = createWorldState(signals);
    this.out = createWorldState(signals);
  }

  update(src: FrameSource | null): WorldState | null {
    if (!src?.curr) {
      this.ready = false;
      return null;
    }
    const offset = src.worldOffset ?? 0;
    if (src.curr.tick !== this.bTick || src.epoch !== this.epoch) {
      readWorld(src.curr.buffer, this.b, offset);
      this.bTick = src.curr.tick;
    }
    const prev = src.prev;
    if (prev && (prev.tick !== this.aTick || src.epoch !== this.epoch)) {
      readWorld(prev.buffer, this.a, offset);
      this.aTick = prev.tick;
    }
    this.epoch = src.epoch;
    blend(prev ? this.a : this.b, this.b, src.alpha(), this.out);
    this.ready = true;
    return this.out;
  }
}

function blend(a: WorldState, b: WorldState, t: number, out: WorldState): void {
  out.time = a.time + (b.time - a.time) * t;
  out.signalsOn = b.signalsOn;
  out.lights.set(b.lights);
  out.walks.set(b.walks);
  out.carCount = b.carCount;
  for (let i = 0; i < b.carCount; i++) {
    const far = i >= a.carCount || Math.abs(b.carX[i] - a.carX[i]) + Math.abs(b.carY[i] - a.carY[i]) > JUMP;
    const k = far ? 1 : t;
    out.carX[i] = a.carX[i] + (b.carX[i] - a.carX[i]) * k;
    out.carY[i] = a.carY[i] + (b.carY[i] - a.carY[i]) * k;
    out.carHeading[i] = far ? b.carHeading[i] : lerpAngle(a.carHeading[i], b.carHeading[i], t);
    out.carSpeed[i] = far ? b.carSpeed[i] : a.carSpeed[i] + (b.carSpeed[i] - a.carSpeed[i]) * t;
    out.carLength[i] = b.carLength[i];
    out.carWidth[i] = b.carWidth[i];
    out.carKind[i] = b.carKind[i];
    out.carFlags[i] = b.carFlags[i];
  }
  out.pedCount = b.pedCount;
  for (let i = 0; i < b.pedCount; i++) {
    const far = i >= a.pedCount || Math.abs(b.pedX[i] - a.pedX[i]) + Math.abs(b.pedY[i] - a.pedY[i]) > JUMP;
    const k = far ? 1 : t;
    out.pedX[i] = a.pedX[i] + (b.pedX[i] - a.pedX[i]) * k;
    out.pedY[i] = a.pedY[i] + (b.pedY[i] - a.pedY[i]) * k;
    out.pedHeading[i] = far ? b.pedHeading[i] : lerpAngle(a.pedHeading[i], b.pedHeading[i], t);
    // The walk cycle wraps from 1 back to 0: blend across the wrap the short way.
    let dp = b.pedPhase[i] - a.pedPhase[i];
    if (dp < -0.5) dp += 1;
    else if (dp > 0.5) dp -= 1;
    out.pedPhase[i] = far ? b.pedPhase[i] : (((a.pedPhase[i] + dp * t) % 1) + 1) % 1;
    out.pedState[i] = b.pedState[i];
    out.pedLook[i] = b.pedLook[i];
  }
}
