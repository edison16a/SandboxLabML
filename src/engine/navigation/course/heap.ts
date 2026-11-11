/**
 * A binary min heap of grid cells keyed by distance, for the distance
 * field's Dijkstra search. Entries are never decreased in place: a shorter
 * path pushes the cell again and the stale entry is skipped when popped,
 * which is simpler and just as fast on a grid this small.
 */
export class CellHeap {
  private readonly cells: Int32Array;
  private readonly keys: Float64Array;
  size = 0;

  constructor(capacity: number) {
    this.cells = new Int32Array(capacity);
    this.keys = new Float64Array(capacity);
  }

  push(cell: number, key: number): void {
    if (this.size >= this.cells.length) throw new Error('CellHeap is full');
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= key) break;
      this.cells[i] = this.cells[parent];
      this.keys[i] = this.keys[parent];
      i = parent;
    }
    this.cells[i] = cell;
    this.keys[i] = key;
  }

  /** Key of the smallest entry. Only valid while size > 0. */
  peekKey(): number {
    return this.keys[0];
  }

  /** Removes the smallest entry and returns its cell. */
  pop(): number {
    const top = this.cells[0];
    const n = --this.size;
    const cell = this.cells[n];
    const key = this.keys[n];
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= n) break;
      if (child + 1 < n && this.keys[child + 1] < this.keys[child]) child++;
      if (this.keys[child] >= key) break;
      this.cells[i] = this.cells[child];
      this.keys[i] = this.keys[child];
      i = child;
    }
    this.cells[i] = cell;
    this.keys[i] = key;
    return top;
  }
}
