/**
 * Keeps distance chips from piling up: each chip placed this frame claims
 * its spot on screen, and a later one within `gap` px of a claimed spot
 * is skipped. Rays that end close together (a wall straight ahead) would
 * otherwise stack their chips into an unreadable block. Fixed size, so it
 * allocates nothing per frame.
 */
export class LabelSpacing {
  private readonly spots: Float32Array;
  private count = 0;

  constructor(
    capacity: number,
    private readonly gap: number,
  ) {
    this.spots = new Float32Array(capacity * 2);
  }

  /** Forgets every claimed spot, at the start of a frame. */
  clear(): void {
    this.count = 0;
  }

  /** Claims the spot (x, y) in px and returns true, or returns false when it sits too near one already claimed. */
  claim(x: number, y: number): boolean {
    const g2 = this.gap * this.gap;
    for (let i = 0; i < this.count; i++) {
      const dx = this.spots[2 * i] - x;
      const dy = this.spots[2 * i + 1] - y;
      if (dx * dx + dy * dy < g2) return false;
    }
    if (this.count * 2 >= this.spots.length) return false;
    this.spots[2 * this.count] = x;
    this.spots[2 * this.count + 1] = y;
    this.count++;
    return true;
  }
}
