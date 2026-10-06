import type { Activation, Genome } from './types';

const ACT_CODE: Record<Activation, number> = { tanh: 0, sigmoid: 1, relu: 2, gaussian: 3, sine: 4 };

/** Applies one activation by numeric code. Kept branchy and inline-friendly for the hot loop. */
function activate(code: number, x: number): number {
  switch (code) {
    case 0:
      return Math.tanh(x);
    case 1:
      return 1 / (1 + Math.exp(-x));
    case 2:
      return x > 0 ? x : 0;
    case 3:
      return Math.exp(-x * x);
    default:
      return Math.sin(x);
  }
}

/**
 * A genome flattened into typed arrays for fast evaluation. Nodes are laid
 * out as [inputs, bias, computed nodes in topological order], and each
 * computed node reads a contiguous slice of (source index, weight) pairs.
 */
export class Network {
  readonly inputCount: number;
  readonly outputCount: number;
  /** Node id for each slot in `values`, so the visualizer can map activity back to nodes. */
  readonly nodeIds: Int32Array;
  /** Latest activation of every node, updated by `activate`. */
  readonly values: Float64Array;
  private readonly start: Int32Array;
  private readonly src: Int32Array;
  private readonly weight: Float64Array;
  private readonly actCode: Uint8Array;
  private readonly outIndex: Int32Array;
  private readonly firstComputed: number;

  constructor(genome: Genome) {
    const ids: number[] = [...genome.inputs, genome.biasId];
    const computed = topologicalOrder(genome);
    ids.push(...computed);
    const slot = new Map<number, number>();
    ids.forEach((id, i) => slot.set(id, i));

    const incoming = new Map<number, Array<[number, number]>>();
    for (const c of genome.connections) {
      if (!c.enabled) continue;
      const s = slot.get(c.from);
      if (s === undefined || !slot.has(c.to)) continue;
      let list = incoming.get(c.to);
      if (!list) incoming.set(c.to, (list = []));
      list.push([s, c.weight]);
    }

    this.inputCount = genome.inputs.length;
    this.outputCount = genome.outputs.length;
    this.firstComputed = this.inputCount + 1;
    this.nodeIds = Int32Array.from(ids);
    this.values = new Float64Array(ids.length);
    this.start = new Int32Array(ids.length + 1);
    this.actCode = new Uint8Array(ids.length);
    const outputs = new Set(genome.outputs);
    const srcList: number[] = [];
    const wList: number[] = [];
    for (let i = 0; i < ids.length; i++) {
      this.start[i] = srcList.length;
      if (i < this.firstComputed) continue;
      for (const [s, w] of incoming.get(ids[i]) ?? []) {
        srcList.push(s);
        wList.push(w);
      }
      this.actCode[i] = outputs.has(ids[i]) ? ACT_CODE.tanh : ACT_CODE[genome.activation];
    }
    this.start[ids.length] = srcList.length;
    this.src = Int32Array.from(srcList);
    this.weight = Float64Array.from(wList);
    this.outIndex = Int32Array.from(genome.outputs.map((id) => slot.get(id) ?? 0));
  }

  /** Runs one forward pass. `out` receives the outputs in action order. */
  activate(inputs: ArrayLike<number>, out: Float32Array | Float64Array | number[]): void {
    const v = this.values;
    const n = this.inputCount;
    for (let i = 0; i < n; i++) v[i] = inputs[i];
    v[n] = 1;
    const { start, src, weight, actCode } = this;
    for (let i = this.firstComputed; i < v.length; i++) {
      let sum = 0;
      for (let k = start[i], end = start[i + 1]; k < end; k++) sum += weight[k] * v[src[k]];
      v[i] = activate(actCode[i], sum);
    }
    for (let j = 0; j < this.outputCount; j++) out[j] = v[this.outIndex[j]];
  }

  /** Multiply-adds per forward pass, which equals the enabled weight count. */
  get cost(): number {
    return this.src.length;
  }
}

/**
 * Orders hidden and output nodes so every node comes after its sources.
 * Mutation never creates cycles, but the sort still guards against one by
 * appending leftovers in id order, which simply reads them as zero.
 */
export function topologicalOrder(genome: Genome): number[] {
  const fixed = new Set<number>([...genome.inputs, genome.biasId]);
  const targets = genome.nodes.filter((n) => !fixed.has(n.id)).map((n) => n.id);
  const indegree = new Map<number, number>(targets.map((id) => [id, 0]));
  const edges = new Map<number, number[]>();
  for (const c of genome.connections) {
    if (!c.enabled || !indegree.has(c.to)) continue;
    if (indegree.has(c.from)) {
      indegree.set(c.to, (indegree.get(c.to) ?? 0) + 1);
      let list = edges.get(c.from);
      if (!list) edges.set(c.from, (list = []));
      list.push(c.to);
    }
  }
  const ready = targets.filter((id) => indegree.get(id) === 0).sort((a, b) => a - b);
  const order: number[] = [];
  while (ready.length) {
    const id = ready.shift() as number;
    order.push(id);
    for (const next of edges.get(id) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, d);
      if (d === 0) {
        const at = ready.findIndex((r) => r > next);
        ready.splice(at < 0 ? ready.length : at, 0, next);
      }
    }
  }
  if (order.length < targets.length) {
    const seen = new Set(order);
    for (const id of [...targets].sort((a, b) => a - b)) if (!seen.has(id)) order.push(id);
  }
  return order;
}
