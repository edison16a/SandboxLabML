/** Points kept, and the least spacing between them, m: together about 70 m of road at racing speed. */
const SIZE = 160;
const SPACING = 0.45;

/**
 * The path a car has just driven, as a ring of recent positions. A camera
 * that sits on this path some meters back stays over the road through any
 * bend, where a camera simply placed behind the car would swing out into
 * the trees or a grandstand.
 */
export class Trail {
  private readonly xs = new Float32Array(SIZE);
  private readonly zs = new Float32Array(SIZE);
  private head = -1;
  private count = 0;

  /** Records the car's position; a jump of more than 20 m (a restart on the grid) starts a new path. */
  push(x: number, z: number): void {
    if (this.count > 0) {
      const d = (x - this.xs[this.head]) ** 2 + (z - this.zs[this.head]) ** 2;
      if (d > 400) this.count = 0;
      else if (d < SPACING * SPACING) return;
    }
    this.head = (this.head + 1) % SIZE;
    this.xs[this.head] = x;
    this.zs[this.head] = z;
    this.count = Math.min(SIZE, this.count + 1);
  }

  /**
   * The point `back` meters behind the newest one, measured along the path,
   * written to `out` with the path's direction there (unit x and z). With a
   * path shorter than that, the oldest point stands in.
   */
  behind(back: number, out: { x: number; z: number; dx: number; dz: number }): boolean {
    if (this.count < 2) return false;
    let left = back;
    let i = this.head;
    for (let k = 1; k < this.count; k++) {
      const j = (i - 1 + SIZE) % SIZE;
      const sx = this.xs[i] - this.xs[j];
      const sz = this.zs[i] - this.zs[j];
      const len = Math.hypot(sx, sz) || 1e-6;
      out.dx = sx / len;
      out.dz = sz / len;
      if (len >= left) {
        out.x = this.xs[i] - out.dx * left;
        out.z = this.zs[i] - out.dz * left;
        return true;
      }
      left -= len;
      i = j;
    }
    out.x = this.xs[i];
    out.z = this.zs[i];
    return true;
  }
}
