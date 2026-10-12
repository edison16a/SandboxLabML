import { topologicalOrder } from './network';
import type { Genome } from './types';

/**
 * How many hidden layers a grown brain has: the most hidden neurons in a
 * row on any path of enabled links from an input to an output. NEAT adds
 * neurons anywhere, so this is the depth the network reaches, not a count
 * of tidy layers. A brain wired straight from inputs to outputs has 0.
 */
export function hiddenDepth(g: Genome): number {
  const depth = new Map<number, number>();
  const hidden = new Set(g.nodes.filter((n) => n.kind === 'hidden').map((n) => n.id));
  const incoming = new Map<number, number[]>();
  for (const c of g.connections) {
    if (!c.enabled) continue;
    const list = incoming.get(c.to) ?? [];
    list.push(c.from);
    incoming.set(c.to, list);
  }
  let deepest = 0;
  for (const id of topologicalOrder(g)) {
    if (!hidden.has(id)) continue;
    let d = 0;
    for (const from of incoming.get(id) ?? []) d = Math.max(d, depth.get(from) ?? 0);
    depth.set(id, d + 1);
    deepest = Math.max(deepest, d + 1);
  }
  return deepest;
}
