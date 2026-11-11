import type { City, CitySpec } from './types';

/** Block sizes the street layout supports: room for two intersections and a stretch of lane between. */
export const MIN_BLOCK = 50;
export const MAX_BLOCK = 140;

/** Problems with a spec before anything is built from it; empty when it is fine. */
export function specProblems(spec: CitySpec): string[] {
  const out: string[] = [];
  const sizes = [...spec.columns, ...spec.rows];
  if (spec.columns.length < 2 || spec.rows.length < 2) out.push('A city needs at least 2 by 2 blocks.');
  if (spec.columns.length > 6 || spec.rows.length > 6) out.push('A city has at most 6 by 6 blocks.');
  if (sizes.some((s) => !(s >= MIN_BLOCK && s <= MAX_BLOCK))) out.push(`Blocks must be ${MIN_BLOCK} to ${MAX_BLOCK} m.`);
  return out;
}

function reach(count: number, edges: (i: number) => number[], start: number): Uint8Array {
  const seen = new Uint8Array(count);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of edges(i)) {
      if (!seen[j]) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return seen;
}

/**
 * True when every road element can reach every other one: a car may start
 * on any lane and still get anywhere. Checked forward from one lane and
 * backward to it, which together prove the graph is strongly connected.
 */
export function everyLaneReachable(city: City): boolean {
  const n = city.elements.length;
  const back: number[][] = city.elements.map(() => []);
  city.elements.forEach((e) => e.next.forEach((j) => back[j].push(e.id)));
  const forward = reach(n, (i) => city.elements[i].next, 0);
  const backward = reach(n, (i) => back[i], 0);
  for (let i = 0; i < n; i++) if (!forward[i] || !backward[i]) return false;
  return true;
}
