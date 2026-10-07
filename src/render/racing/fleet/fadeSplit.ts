/** How fast a car's opacity follows its target, per second: gone or back in about a third of a second. */
const RATE = 9;
/** Opacity at or above which a car simply draws solid, and below which it is not drawn at all. */
const SOLID = 0.985;
const GONE = 0.02;

/**
 * Splits an instanced field of cars into the ones drawn solid and the few
 * fading in or out, which draw in a small transparent pass. Each car's
 * opacity eases toward its target over time, so a car crossing the lens
 * or the line of sight to the followed car melts away instead of cutting
 * out or breaking into a dither pattern. Typed arrays only: nothing is
 * allocated per frame.
 */
export class FadeSplit {
  readonly shown: Float32Array;
  /** Draw slot to car index, for the solid and fading lists. */
  readonly solid: Int32Array;
  readonly fading: Int32Array;
  solidCount = 0;
  fadeCount = 0;
  private ease = 1;

  constructor(capacity: number) {
    this.shown = new Float32Array(capacity).fill(1);
    this.solid = new Int32Array(capacity);
    this.fading = new Int32Array(capacity);
  }

  /** Starts a frame `dt` seconds long with both lists empty. */
  begin(dt: number): void {
    this.solidCount = this.fadeCount = 0;
    this.ease = 1 - Math.exp(-RATE * dt);
  }

  /**
   * Moves car i's opacity toward `target` (0 to 1) and files it in a list.
   * `snap` jumps straight there, for the car the detailed model replaces.
   * Returns the opacity to draw it with.
   */
  place(i: number, target: number, snap = false): number {
    let v = snap ? target : this.shown[i] + (target - this.shown[i]) * this.ease;
    if (v < GONE && target < GONE) v = 0;
    this.shown[i] = v;
    if (v >= SOLID) this.solid[this.solidCount++] = i;
    else if (v > GONE) this.fading[this.fadeCount++] = i;
    return v;
  }
}
