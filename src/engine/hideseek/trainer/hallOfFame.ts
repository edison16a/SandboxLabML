import type { Rng } from '../../core/rng';
import { cloneGenome } from '../../neat/genome';
import type { Genome } from '../../neat/types';
import type { HallOfFameEntry } from './types';

/**
 * Past champions of one team. Playing against them as well as the current
 * opponents keeps co-evolution from going in circles, where a team forgets
 * how to beat an old strategy because nobody uses it any more. Oldest
 * entries drop out first once the hall is full.
 */
export class HallOfFame {
  private cap: number;
  private entries: HallOfFameEntry[];

  constructor(capacity: number, entries: HallOfFameEntry[] = []) {
    this.cap = capacity;
    this.entries = entries.map((e) => ({ ...e, genome: cloneGenome(e.genome) }));
  }

  get capacity(): number {
    return this.cap;
  }

  get size(): number {
    return this.entries.length;
  }

  /** Changes how many champions are kept. Shrinking drops the oldest ones right away. */
  resize(capacity: number): void {
    this.cap = Math.max(1, Math.round(capacity));
    if (this.entries.length > this.cap) this.entries.splice(0, this.entries.length - this.cap);
  }

  /** Stores a copy, so later changes to the population never reach the hall. */
  add(genome: Genome, generation: number): void {
    this.entries.push({ genome: cloneGenome(genome), generation, fitness: genome.fitness });
    if (this.entries.length > this.cap) this.entries.splice(0, this.entries.length - this.cap);
  }

  /** A uniformly random champion, or null when the hall is empty. */
  sample(rng: Rng): Genome | null {
    return this.entries.length ? rng.pick(this.entries).genome : null;
  }

  toState(): HallOfFameEntry[] {
    return this.entries.map((e) => ({ ...e, genome: cloneGenome(e.genome) }));
  }
}
