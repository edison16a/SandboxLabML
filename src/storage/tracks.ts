import type { TrackSpec } from '@/engine/racing/track/types';
import { db } from './db';

/** Saved tracks carry this id prefix, so the gallery can tell them from built ins and random ones. */
export const SAVED_TRACK_PREFIX = 'saved-';

/** The user's saved tracks, most recently saved first. */
export async function listTracks(): Promise<TrackSpec[]> {
  const rows = await db().tracks.orderBy('updatedAt').reverse().toArray();
  return rows.map((r) => r.spec);
}

/**
 * Saves a track under a name. Saving again under a name already in use
 * replaces that track, which is what someone tweaking "My loop" expects,
 * rather than piling up copies with the same name.
 */
export async function saveTrack(name: string, spec: TrackSpec): Promise<TrackSpec> {
  const clean = name.trim().slice(0, 40) || 'Untitled track';
  const existing = (await db().tracks.toArray()).find((r) => r.name.toLowerCase() === clean.toLowerCase());
  const id = existing?.id ?? `${SAVED_TRACK_PREFIX}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const saved: TrackSpec = { id, name: clean, width: spec.width, points: spec.points.map(([x, y]) => [x, y]) };
  await db().tracks.put({ id, name: clean, spec: saved, updatedAt: Date.now() });
  return saved;
}

export async function deleteTrack(id: string): Promise<void> {
  await db().tracks.delete(id);
}
