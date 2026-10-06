import type { Rng } from '../core/rng';
import { clamp } from '../core/math';
import type { MutationRates } from './config';
import { hasNode, insertConnection } from './genome';
import type { InnovationTracker } from './innovation';
import type { Genome } from './types';

/**
 * Nudges most weights by a small gaussian step and replaces a few outright.
 * Replacement lets a stuck weight escape a bad region in one move.
 */
export function mutateWeights(g: Genome, rates: MutationRates, rng: Rng, range: number): void {
  for (const c of g.connections) {
    // Weights are rounded to float32 so the binary format stores them exactly.
    if (rng.chance(rates.replaceWeight)) c.weight = Math.fround(rng.range(-2, 2));
    else c.weight = Math.fround(clamp(c.weight + rng.gaussian() * rates.weightPower, -range, range));
  }
}

/** True if `to` can already reach `from`, meaning a new from->to link would close a loop. */
function wouldCycle(g: Genome, from: number, to: number): boolean {
  if (from === to) return true;
  const stack = [to];
  const seen = new Set<number>();
  while (stack.length) {
    const n = stack.pop() as number;
    if (n === from) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const c of g.connections) if (c.from === n) stack.push(c.to);
  }
  return false;
}

/** Adds one new forward connection between two unconnected nodes, if one can be found. */
export function mutateAddConnection(g: Genome, tracker: InnovationTracker, rng: Rng): boolean {
  const sources = g.nodes.filter((n) => n.kind !== 'output');
  const targets = g.nodes.filter((n) => n.kind === 'hidden' || n.kind === 'output');
  if (!targets.length) return false;
  const existing = new Set(g.connections.map((c) => `${c.from}>${c.to}`));
  for (let attempt = 0; attempt < 24; attempt++) {
    const from = rng.pick(sources).id;
    const to = rng.pick(targets).id;
    if (existing.has(`${from}>${to}`) || wouldCycle(g, from, to)) continue;
    insertConnection(g, {
      innovation: tracker.connection(from, to),
      from,
      to,
      weight: Math.fround(rng.range(-1, 1)),
      enabled: true,
    });
    return true;
  }
  return false;
}

/**
 * Splits an enabled connection A->B into A->N->B. The incoming link gets
 * weight 1 and the outgoing link keeps the old weight, so the network
 * behaves almost the same right after the split.
 */
export function mutateAddNode(g: Genome, tracker: InnovationTracker, rng: Rng): boolean {
  const enabled = g.connections.filter((c) => c.enabled);
  if (!enabled.length) return false;
  const old = rng.pick(enabled);
  const id = tracker.splitNode(old.innovation, (nid) => hasNode(g, nid));
  old.enabled = false;
  g.nodes.push({ id, kind: 'hidden' });
  insertConnection(g, { innovation: tracker.connection(old.from, id), from: old.from, to: id, weight: 1, enabled: true });
  insertConnection(g, { innovation: tracker.connection(id, old.to), from: id, to: old.to, weight: old.weight, enabled: true });
  return true;
}

/** Flips one connection on or off. Disabled genes stay in the genome so they can come back. */
export function mutateToggle(g: Genome, rng: Rng): boolean {
  if (!g.connections.length) return false;
  const c = rng.pick(g.connections);
  c.enabled = !c.enabled;
  return true;
}

/** Applies every mutation type with its configured probability. */
export function mutate(g: Genome, rates: MutationRates, tracker: InnovationTracker, rng: Rng, range: number): void {
  if (rng.chance(rates.addNode)) mutateAddNode(g, tracker, rng);
  if (rng.chance(rates.addConnection)) mutateAddConnection(g, tracker, rng);
  if (rng.chance(rates.weights)) mutateWeights(g, rates, rng, range);
  if (rng.chance(rates.toggle)) mutateToggle(g, rng);
}
