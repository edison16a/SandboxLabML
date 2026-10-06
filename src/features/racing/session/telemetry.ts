import type { GhostTelemetry } from '@/workers/replay/ghostPlayer';

/**
 * Meters a replayed car drove from its own grid slot. A car that starts
 * 30 m back and crashes 20 m later reads 20, not the -10 its progress says.
 */
export function drivenDistance(t: Pick<GhostTelemetry, 'distance'>): number {
  const end = t.distance[t.distance.length - 1] ?? 0;
  return Math.max(0, end - (t.distance[0] ?? 0));
}

/** For each champion, the telemetry of its copy nearest the front of the grid, which speaks for the champion in lists. */
export function frontCopies<T extends Pick<GhostTelemetry, 'generation' | 'slot'>>(telemetry: readonly T[]): Map<number, T> {
  const out = new Map<number, T>();
  for (const t of telemetry) {
    const seen = out.get(t.generation);
    if (!seen || t.slot < seen.slot) out.set(t.generation, t);
  }
  return out;
}
