import type * as THREE from 'three';
import { apart, atLens, clearance, ramp } from './clearance';

/** What the pack is drawn around this frame. */
export interface PackFocus {
  /** The car the detailed model replaces, never drawn here; -1 for none. */
  hidden: number;
  /** True in the views about one car (chase and trackside), which also clear the line of sight to it. */
  clearFocus: boolean;
  /** True while a car is followed, so copies overlapping it fade in every view. */
  hasFocus: boolean;
  cam: THREE.Vector3;
  focus: THREE.Vector3;
  yaw: number;
}

/**
 * Turns a 0 to 1 "how much of this car may show" into draw or don't, with
 * a band between so a car sitting at the edge of a rule never flickers or
 * hangs half transparent. A shown car stays until the rule drops under a
 * quarter; a hidden one comes back once it rises past three quarters. The
 * fade then plays out over time, so the change is a short melt.
 */
export function settle(keep: number, shown: number): 0 | 1 {
  return shown > 0.5 ? (keep < 0.25 ? 0 : 1) : keep > 0.75 ? 1 : 0;
}

/** Distance between two car centers, m, past which their bodies cannot touch. */
const TOUCH = 5.2;

/**
 * Picks which cars of the live generation to draw. The simulation lets
 * cars drive through each other, and late in training a whole generation
 * shares one line, so bodies would cut into one another and flicker where
 * their surfaces meet. Cars still driving are placed first, then stopped
 * ones, and each is kept only if its body clears every car kept before it,
 * so a running car never vanishes for a wreck. Cars at the lens, on the
 * line of sight or inside the followed car drop out as well. Typed arrays
 * only; about n squared over two cheap checks for nearby pairs.
 */
export class PackView {
  /** 1 for each car to draw this frame, 0 for the rest. */
  readonly target: Uint8Array;
  private readonly kept: Int32Array;
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;

  constructor(capacity: number) {
    this.target = new Uint8Array(capacity);
    this.kept = new Int32Array(capacity);
    this.cos = new Float32Array(capacity);
    this.sin = new Float32Array(capacity);
  }

  /**
   * `poses` holds (x, y, heading) per car in simulation coordinates,
   * `stopped` flags crashed or finished cars, and `shown` is each car's
   * current opacity, which sets which side of the band it starts from.
   */
  decide(n: number, poses: Float32Array, stopped: Uint8Array, shown: Float32Array, f: PackFocus): void {
    for (let i = 0; i < n; i++) {
      this.cos[i] = Math.cos(poses[i * 3 + 2]);
      this.sin[i] = Math.sin(poses[i * 3 + 2]);
    }
    let kept = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        if (stopped[i] !== pass) continue;
        let keep = 0;
        if (i !== f.hidden) {
          const x = poses[i * 3];
          const z = -poses[i * 3 + 1];
          keep = f.clearFocus ? clearance(x, z, f.focus, f.yaw, f.cam) : atLens(x, z, f.cam);
          if (!f.clearFocus && f.hasFocus) keep = Math.min(keep, apart(x, z, f.focus, f.yaw));
          if (keep > 0) keep = Math.min(keep, this.clearOfKept(i, poses, kept));
        }
        const t = settle(keep, shown[i]);
        this.target[i] = t;
        if (t) this.kept[kept++] = i;
      }
    }
  }

  /** How clear car i's body is of every car kept so far, 0 when it overlaps one, measured in that car's own frame. */
  private clearOfKept(i: number, poses: Float32Array, kept: number): number {
    const x = poses[i * 3];
    const y = poses[i * 3 + 1];
    let keep = 1;
    for (let k = 0; k < kept && keep > 0; k++) {
      const j = this.kept[k];
      const dx = x - poses[j * 3];
      const dy = y - poses[j * 3 + 1];
      if (dx * dx + dy * dy > TOUCH * TOUCH) continue;
      const along = Math.abs(dx * this.cos[j] + dy * this.sin[j]);
      const across = Math.abs(dy * this.cos[j] - dx * this.sin[j]);
      keep = Math.min(keep, Math.max(ramp(along, 4.1, 4.7), ramp(across, 1.75, 2.15)));
    }
    return keep;
  }
}
