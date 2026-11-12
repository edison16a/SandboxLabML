/** Height of a car's middle and of the followed SUV's, for the sight line, m. */
const MID = 0.9;
/** A ghost whose middle comes this close to the sight line fills part of the frame round the followed SUV, m. */
const SIGHT_RADIUS = 2.1;
/** Ghosts on the last stretch before the followed SUV already fade by their distance to it; this keeps the two tests apart, m. */
const NEAR_END = 2.5;

/**
 * True when a ghost at (x, z) stands in the camera's line of sight to the
 * followed SUV at (fx, fz): within SIGHT_RADIUS of the segment from the
 * lens to the SUV's middle, somewhere between the two. A ghost there
 * covers the car the camera is meant to show, so it fades out. Plain
 * scalar math, called for every ghost every frame.
 */
export function blocksSight(cx: number, cy: number, cz: number, fx: number, fz: number, x: number, z: number): boolean {
  const dx = fx - cx;
  const dy = MID - cy;
  const dz = fz - cz;
  const len2 = dx * dx + dy * dy + dz * dz;
  if (len2 < 1e-6) return false;
  const t = ((x - cx) * dx + (MID - cy) * dy + (z - cz) * dz) / len2;
  const len = Math.sqrt(len2);
  if (t <= 0 || t * len > len - NEAR_END) return false;
  const px = cx + dx * t - x;
  const py = cy + dy * t - MID;
  const pz = cz + dz * t - z;
  return px * px + py * py + pz * pz < SIGHT_RADIUS * SIGHT_RADIUS;
}

/** Two ghosts closer than this and turned the same way share a spot, m and radians. */
const SAME_SPOT = 1.1;
const SAME_HEADING = 0.35;

/**
 * The spots of the ghosts drawn so far this frame. Past champions replay
 * the same trip from the same start, so several can sit on one spot and
 * read as one car with many roofs; the later ones give way to the first.
 * Fixed size, allocation free.
 */
export class PoseSet {
  private readonly x: Float32Array;
  private readonly z: Float32Array;
  private readonly h: Float32Array;
  private n = 0;

  constructor(capacity: number) {
    this.x = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.h = new Float32Array(capacity);
  }

  clear(): void {
    this.n = 0;
  }

  add(x: number, z: number, heading: number): void {
    if (this.n >= this.x.length) return;
    this.x[this.n] = x;
    this.z[this.n] = z;
    this.h[this.n] = heading;
    this.n++;
  }

  /** Whether a ghost drawn already sits on this spot, turned the same way. */
  has(x: number, z: number, heading: number): boolean {
    for (let i = 0; i < this.n; i++) {
      if (Math.abs(this.x[i] - x) > SAME_SPOT || Math.abs(this.z[i] - z) > SAME_SPOT) continue;
      const d = Math.atan2(Math.sin(heading - this.h[i]), Math.cos(heading - this.h[i]));
      if (Math.abs(d) < SAME_HEADING) return true;
    }
    return false;
  }
}
