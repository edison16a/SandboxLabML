import type { TrackSpec } from '@/engine/racing/track/types';
import { db, type TrackRow } from './db';

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

/** Deletes a saved track and hands back its row, so Undo can put it back as it was. */
export async function deleteTrack(id: string): Promise<TrackRow | undefined> {
  const d = db();
  return d.transaction('rw', d.tracks, async () => {
    const row = await d.tracks.get(id);
    await d.tracks.delete(id);
    return row;
  });
}

/** Puts a deleted track back with its own id and save time, so it returns to its old place in the list. */
export async function restoreTrack(row: TrackRow): Promise<void> {
  await db().tracks.put(row);
}
