import type { Rng } from '../../core/rng';
import { ELEMENT_CONNECTOR, ELEMENT_LANE, type City } from '../city/types';

/** Sideways acceleration a driver is happy with in a turn, m/s^2. */
const TURN_GRIP = 2.4;

/**
 * The other cars, as flat arrays. Each car rides one road element at a
 * time and always knows the next two it will take, so the car following
 * rules can look past the end of its lane into the intersection and out
 * the other side.
 */
export class Fleet {
  readonly cap: number;
  count = 0;
  /** Current element, the next one and the one after. */
  readonly el: Int32Array;
  readonly nxt: Int32Array;
  readonly nxt2: Int32Array;
  /** Arc length along the current element, m (the car's center). */
  readonly s: Float64Array;
  readonly v: Float64Array;
  readonly accel: Float64Array;
  /** The speed this driver likes on an open street, m/s. */
  readonly v0: Float64Array;
  readonly kind: Uint8Array;
  readonly len: Float64Array;
  readonly wid: Float64Array;
  /** Seconds spent standing still, to clear a car out of a jam that will not move. */
  readonly still: Float64Array;
  /** Cars on each element as a linked list rebuilt every tick: head per element, next per car. */
  readonly head: Int32Array;
  readonly link: Int32Array;
  /** For each lane, the lane arriving at the same node head on, or -1. */
  readonly oncoming: Int32Array;
  /** Comfortable speed through each element, m/s: a turn's radius sets it, straight runs are unlimited. */
  readonly turnSpeed: Float64Array;
  /** Connectors through each node, to check whether an intersection is clear. */
  readonly nodeConnectors: number[][];
  /** World pose of each car after the last tick. */
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly ph: Float64Array;

  constructor(
    readonly city: City,
    cap: number,
  ) {
    this.cap = cap;
    this.el = new Int32Array(cap);
    this.nxt = new Int32Array(cap);
    this.nxt2 = new Int32Array(cap);
    this.s = new Float64Array(cap);
    this.v = new Float64Array(cap);
    this.accel = new Float64Array(cap);
    this.v0 = new Float64Array(cap);
    this.kind = new Uint8Array(cap);
    this.len = new Float64Array(cap);
    this.wid = new Float64Array(cap);
    this.still = new Float64Array(cap);
    this.head = new Int32Array(city.elements.length);
    this.link = new Int32Array(cap);
    this.oncoming = new Int32Array(city.laneCount).fill(-1);
    this.px = new Float64Array(cap);
    this.py = new Float64Array(cap);
    this.ph = new Float64Array(cap);
    this.nodeConnectors = city.nodes.map(() => []);
    this.turnSpeed = new Float64Array(city.elements.length).fill(Infinity);
    for (const e of city.elements) {
      if (e.kind !== ELEMENT_CONNECTOR) continue;
      this.nodeConnectors[e.from].push(e.id);
      let k = 0;
      for (let i = 0; i < e.path.n; i++) k = Math.max(k, Math.abs(e.path.k[i]));
      if (e.turn !== 0) this.turnSpeed[e.id] = Math.sqrt(TURN_GRIP / Math.max(k, 1e-3));
    }
    for (const lane of city.elements) {
      if (lane.kind !== ELEMENT_LANE) continue;
      for (const c of lane.next) {
        const k = city.elements[c];
        // The lane straight on continues this one; the lane opposite it comes the other way.
        if (k.turn === 0) this.oncoming[lane.id] = city.elements[k.toLane].opposite;
      }
    }
  }

  /** A turn at random at the end of `element`: straight more often than not. */
  choose(element: number, rng: Rng): number {
    const e = this.city.elements[element];
    if (e.kind === ELEMENT_CONNECTOR) return e.next[0];
    let total = 0;
    for (const c of e.next) total += weight(this.city.elements[c].turn);
    let pick = rng.next() * total;
    for (const c of e.next) {
      pick -= weight(this.city.elements[c].turn);
      if (pick <= 0) return c;
    }
    return e.next[e.next.length - 1];
  }

  /** Puts car i on `element` at arc length s, and plans its next two moves. */
  place(i: number, element: number, s: number, rng: Rng): void {
    this.el[i] = element;
    this.s[i] = s;
    this.nxt[i] = this.choose(element, rng);
    this.nxt2[i] = this.choose(this.nxt[i], rng);
    this.still[i] = 0;
  }

  /** Moves car i on to its next element, carrying `over` meters into it. */
  advance(i: number, over: number, rng: Rng): void {
    this.el[i] = this.nxt[i];
    this.nxt[i] = this.nxt2[i];
    this.nxt2[i] = this.choose(this.nxt[i], rng);
    this.s[i] = over;
  }

  /** Rebuilds the per element lists. */
  index(): void {
    this.head.fill(-1);
    for (let i = 0; i < this.count; i++) {
      this.link[i] = this.head[this.el[i]];
      this.head[this.el[i]] = i;
    }
  }
}

function weight(turn: number): number {
  return turn === 0 ? 2 : 1;
}
