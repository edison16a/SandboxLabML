import { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';

/**
 * A brain with some inputs overridden, for the Sandbox lesion test. The
 * match still computes every observation, but before each forward pass the
 * chosen inputs are replaced (by 0, or by a frozen value), so the brain
 * keeps acting on a world it can no longer fully sense. Only the Sandbox
 * builds these; training never sees them.
 */
export class LesionNetwork extends Network {
  /** What the brain actually received on its latest tick, lesions applied. */
  readonly effective: Float64Array;
  private readonly forced = new Map<number, number>();

  constructor(genome: Genome) {
    super(genome);
    this.effective = new Float64Array(this.inputCount);
  }

  /** Forces input `index` to `value`, or lets it through again with null. */
  setLesion(index: number, value: number | null): void {
    if (index < 0 || index >= this.inputCount) return;
    if (value === null) this.forced.delete(index);
    else this.forced.set(index, value);
  }

  clearLesions(): void {
    this.forced.clear();
  }

  lesions(): Array<[number, number]> {
    return [...this.forced.entries()];
  }

  override activate(inputs: ArrayLike<number>, out: Float32Array | Float64Array | number[]): void {
    const e = this.effective;
    for (let i = 0; i < e.length; i++) e[i] = inputs[i];
    for (const [i, v] of this.forced) e[i] = v;
    super.activate(e, out);
  }
}
