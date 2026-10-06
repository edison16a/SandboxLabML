import { create } from 'zustand';
import type { TrackSpec } from '@/engine/racing/track/types';
import type { TrackRow } from '@/storage/db';
import { deleteTrack, listTracks, restoreTrack, saveTrack } from '@/storage/tracks';

interface SavedTracksState {
  tracks: TrackSpec[];
  loaded: boolean;
  /** Reads the list once, and again after a reset; other calls are free. A failed read is tried again next time. */
  load: () => Promise<void>;
  save: (name: string, spec: TrackSpec) => Promise<TrackSpec>;
  /** Resolves to the deleted row, for Undo, or undefined when it was already gone. */
  remove: (id: string) => Promise<TrackRow | undefined>;
  restore: (row: TrackRow) => Promise<void>;
  /** Forgets the list after storage was wiped, so the next load reads it fresh. */
  reset: () => void;
}

let reading: Promise<void> | null = null;

/** The user's saved tracks, shared by the Sandbox gallery and its save button. */
export const useSavedTracks = create<SavedTracksState>((set, get) => ({
  tracks: [],
  loaded: false,
  load: () => {
    if (get().loaded) return Promise.resolve();
    if (reading) return reading;
    const read: Promise<void> = listTracks()
      .then((stored) => {
        // A reset while this read was out means its rows may be gone already.
        if (reading !== read) return;
        // A save that finished while the list was being read is already in the state; keep it on top.
        const fresh = get().tracks;
        set({ tracks: [...fresh, ...stored.filter((t) => !fresh.some((f) => f.id === t.id))], loaded: true });
      })
      .catch(() => undefined)
      .finally(() => {
        if (reading === read) reading = null;
      });
    reading = read;
    return read;
  },
  save: async (name, spec) => {
    const saved = await saveTrack(name, spec);
    set({ tracks: [saved, ...get().tracks.filter((t) => t.id !== saved.id)] });
    return saved;
  },
  remove: async (id) => {
    const row = await deleteTrack(id);
    set({ tracks: get().tracks.filter((t) => t.id !== id) });
    return row;
  },
  restore: async (row) => {
    await restoreTrack(row);
    // Read the list back so the track lands where its save time puts it.
    set({ tracks: await listTracks() });
  },
  reset: () => {
    reading = null;
    set({ tracks: [], loaded: false });
  },
}));
