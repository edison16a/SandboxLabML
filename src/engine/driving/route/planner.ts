import { Rng } from '../../core/rng';
import { ELEMENT_CONNECTOR, ELEMENT_LANE, type City } from '../city/types';

/** Extra cost of a turn, m, so the planner picks the simpler of two equally short trips. */
const TURN_COST = { [-1]: 18, 0: 0, 1: 9 } as const;

/** Shortest path tree from one element: cost to reach every element and the element before it. */
export interface PathTree {
  dist: Float64Array;
  prev: Int32Array;
}

/**
 * Dijkstra over the lane graph from `from`, with a small penalty per turn.
 * The graph has a few hundred elements, so a plain array scan beats a heap.
 */
export function shortestTree(city: City, from: number): PathTree {
  const n = city.elements.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from] = 0;
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u < 0) break;
    done[u] = 1;
    for (const v of city.elements[u].next) {
      const next = city.elements[v];
      const cost = best + next.path.length + (next.kind === ELEMENT_CONNECTOR ? TURN_COST[next.turn] : 0);
      if (cost < dist[v]) {
        dist[v] = cost;
        prev[v] = u;
      }
    }
  }
  return { dist, prev };
}

/** The chain of elements from the tree's root to `to`, or null if `to` cannot be reached. */
export function chainTo(tree: PathTree, to: number): number[] | null {
  if (!Number.isFinite(tree.dist[to])) return null;
  const chain: number[] = [];
  for (let v = to; v >= 0; v = tree.prev[v]) chain.push(v);
  return chain.reverse();
}

/** A trip as stored with a run: plain numbers, rebuilt into a Route with buildRoute. */
export interface RouteSpec {
  elements: number[];
  /** Meters into the first lane where the trip starts, and into the last lane where it ends. */
  startS: number;
  destS: number;
}

export interface RouteOptions {
  /** Trip length along the road, m. */
  minLength: number;
  maxLength: number;
  /** Turns (left or right) the trip must include. */
  minTurns: number;
}

export const DEFAULT_ROUTE: RouteOptions = { minLength: 260, maxLength: 620, minTurns: 1 };

function turnsIn(city: City, chain: number[]): number {
  let n = 0;
  for (const id of chain) if (city.elements[id].turn !== 0) n++;
  return n;
}

/**
 * A seeded trip: a start lane, then any reachable lane whose trip length
 * and turn count fit the options. Same city and seed, same trip, so every
 * learner of a generation gets it and the next generation gets a new one.
 */
export function pickRoute(city: City, seed: number, opts: RouteOptions = DEFAULT_ROUTE): RouteSpec {
  const rng = new Rng(seed ^ 0x7a11);
  const lanes = city.elements.filter((e) => e.kind === ELEMENT_LANE && e.path.length >= 40);
  let fallback: RouteSpec | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const start = rng.pick(lanes);
    const startS = Math.min(14, start.path.length * 0.25);
    const tree = shortestTree(city, start.id);
    const fits = lanes.filter((d) => {
      if (d.id === start.id || !Number.isFinite(tree.dist[d.id])) return false;
      const length = tree.dist[d.id] - startS - d.path.length * 0.4;
      return length >= opts.minLength && length <= opts.maxLength;
    });
    rng.shuffle(fits);
    for (const dest of fits) {
      const chain = chainTo(tree, dest.id)!;
      const spec = { elements: chain, startS, destS: dest.path.length * 0.6 };
      if (turnsIn(city, chain) >= opts.minTurns) return spec;
      fallback ??= spec;
    }
  }
  if (fallback) return fallback;
  throw new Error('No route fits these options in this city.');
}
