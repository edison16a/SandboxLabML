import type { Rng } from '../../core/rng';
import { startLineX } from './formation';
import { FINISH_INSET, type ObstacleSpec, type Rect } from './types';

/** Clear ground kept past the start line, m, so the grid sets off before anything is in the way. */
const START_CLEAR = 1.5;
/** Clear ground kept before the finish line, m. */
const FINISH_CLEAR = 1.2;
/**
 * Clear ground kept along the outer walls by pieces that do not span the
 * room, m: wide enough to walk past with room to spare, so no slot is
 * almost wide enough to squeeze into.
 */
const SIDE_CLEAR = 1.1;

/**
 * A course being generated: the obstacles placed so far and the floor they
 * take, so each new piece can be tested against the rest before it goes in.
 */
export class CourseDraft {
  readonly obstacles: ObstacleSpec[] = [];
  /** Footprints taken, each grown by the gap its piece asked to keep. */
  private readonly taken: Rect[] = [];
  readonly startLine: number;
  readonly finishX: number;

  constructor(
    readonly length: number,
    readonly width: number,
    readonly rng: Rng,
  ) {
    this.startLine = startLineX(length);
    this.finishX = length / 2 - FINISH_INSET;
  }

  /** First and last x obstacles may reach, m. */
  get bandStart(): number {
    return this.startLine + START_CLEAR;
  }

  get bandEnd(): number {
    return this.finishX - FINISH_CLEAR;
  }

  /**
   * Whether rectangle r is free: inside the band, clear of the outer walls
   * (unless `toWalls`, for walls that span the room) and at least `gap` m
   * from everything already placed.
   */
  fits(r: Rect, gap: number, toWalls = false): boolean {
    if (r.x - r.hx < this.bandStart || r.x + r.hx > this.bandEnd) return false;
    const side = this.width / 2 - (toWalls ? 0 : SIDE_CLEAR);
    if (r.z - r.hz < -side - 1e-9 || r.z + r.hz > side + 1e-9) return false;
    for (const t of this.taken) {
      if (Math.abs(r.x - t.x) < r.hx + t.hx + gap && Math.abs(r.z - t.z) < r.hz + t.hz + gap) return false;
    }
    return true;
  }

  /** Adds an obstacle and marks its footprint (or `area`, for a mover's sweep) as taken. */
  add(o: ObstacleSpec, area: Rect): void {
    this.obstacles.push(o);
    this.taken.push(area);
  }

  /** Marks floor as taken without placing anything: a lane kept open. */
  reserve(area: Rect): void {
    this.taken.push(area);
  }

  /** Splits the band into `n` equal stretches along x, as [start, end] pairs. */
  zones(n: number): Array<[number, number]> {
    const span = (this.bandEnd - this.bandStart) / n;
    return Array.from({ length: n }, (_, i) => [this.bandStart + i * span, this.bandStart + (i + 1) * span]);
  }
}

/** Rounds to 5 cm (or to 1 / `per` m), so generated courses read as tidy numbers in a saved run. */
export function snap(v: number, per = 20): number {
  return Math.round(v * per) / per;
}
