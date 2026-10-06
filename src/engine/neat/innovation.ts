/**
 * Hands out innovation numbers and node ids for a whole run. The same
 * structural change (a connection between the same two nodes, or a split of
 * the same connection) always gets the same number, which is what lets
 * crossover line genomes up.
 */
export interface InnovationState {
  nextInnovation: number;
  nextNodeId: number;
  connections: Array<[string, number]>;
  splits: Array<[number, number]>;
}

export class InnovationTracker {
  private nextInnovation: number;
  private nextNodeId: number;
  private readonly connections = new Map<string, number>();
  /** Connection innovation that was split, mapped to the node id it produced. */
  private readonly splits = new Map<number, number>();

  constructor(firstNodeId = 0, firstInnovation = 0) {
    this.nextNodeId = firstNodeId;
    this.nextInnovation = firstInnovation;
  }

  static fromState(state: InnovationState): InnovationTracker {
    const t = new InnovationTracker(state.nextNodeId, state.nextInnovation);
    for (const [k, v] of state.connections) t.connections.set(k, v);
    for (const [k, v] of state.splits) t.splits.set(k, v);
    return t;
  }

  toState(): InnovationState {
    return {
      nextInnovation: this.nextInnovation,
      nextNodeId: this.nextNodeId,
      connections: [...this.connections],
      splits: [...this.splits],
    };
  }

  connection(from: number, to: number): number {
    const key = `${from}>${to}`;
    let inn = this.connections.get(key);
    if (inn === undefined) {
      inn = this.nextInnovation++;
      this.connections.set(key, inn);
    }
    return inn;
  }

  /**
   * Node id for splitting a connection. If the genome already has that node
   * (it split the same connection before, then re-enabled it), a fresh id is
   * used so ids stay unique inside the genome.
   */
  splitNode(connectionInnovation: number, existing: (id: number) => boolean): number {
    const known = this.splits.get(connectionInnovation);
    if (known !== undefined && !existing(known)) return known;
    const id = this.nextNodeId++;
    if (known === undefined) this.splits.set(connectionInnovation, id);
    return id;
  }

  /** Records an existing link's number, used when rebuilding a tracker from stored genomes. */
  registerConnection(from: number, to: number, innovation: number): void {
    const key = `${from}>${to}`;
    if (!this.connections.has(key)) this.connections.set(key, innovation);
    this.nextInnovation = Math.max(this.nextInnovation, innovation + 1);
  }

  newNodeId(): number {
    return this.nextNodeId++;
  }

  /** Makes sure ids handed out later never collide with ids already in use. */
  reserveNodeIds(upTo: number): void {
    this.nextNodeId = Math.max(this.nextNodeId, upTo);
  }
}
