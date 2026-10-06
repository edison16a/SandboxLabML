import { db } from './db';

export interface StorageBreakdown {
  champions: number;
  checkpoints: number;
  caches: number;
  total: number;
}

/** Bytes a run takes on disk, split the way the model card shows it. */
export async function runStorage(runId: string): Promise<StorageBreakdown> {
  const d = db();
  const gens = await d.generations.where('runId').equals(runId).toArray();
  const champions = gens.reduce((s, g) => s + g.genome.byteLength + 600, 0);
  const cps = await d.checkpoints.where('runId').equals(runId).toArray();
  const checkpoints = cps.reduce((s, c) => s + c.bytes, 0);
  const paths = await d.pathCache.where('runId').equals(runId).toArray();
  const caches = paths.reduce((s, p) => s + p.path.byteLength, 0);
  return { champions, checkpoints, caches, total: champions + checkpoints + caches };
}

/** Whole-database usage from the browser, when it will tell us. */
export async function browserStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}
