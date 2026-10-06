import { create } from 'zustand';
import type { TrackSpec } from '@/engine/racing/track/types';
import { deleteTrack, listTracks, saveTrack } from '@/storage/tracks';

interface SavedTracksState {
  tracks: TrackSpec[];
  loaded: boolean;
  /** Reads the list once per page load; later calls are free. A failed read is tried again next time. */
  load: () => Promise<void>;
  save: (name: string, spec: TrackSpec) => Promise<TrackSpec>;
  remove: (id: string) => Promise<void>;
}

let reading: Promise<void> | null = null;

/** The user's saved tracks, shared by the Sandbox gallery and its save button. */
export const useSavedTracks = create<SavedTracksState>((set, get) => ({
  tracks: [],
  loaded: false,
  load: () => {
    if (get().loaded) return Promise.resolve();
    reading ??= listTracks()
      .then((stored) => {
        // A save that finished while the list was being read is already in the state; keep it on top.
        const fresh = get().tracks;
        set({ tracks: [...fresh, ...stored.filter((t) => !fresh.some((f) => f.id === t.id))], loaded: true });
      })
      .catch(() => undefined)
      .finally(() => (reading = null));
    return reading;
  },
  save: async (name, spec) => {
    const saved = await saveTrack(name, spec);
    set({ tracks: [saved, ...get().tracks.filter((t) => t.id !== saved.id)] });
    return saved;
  },
  remove: async (id) => {
    await deleteTrack(id);
    set({ tracks: get().tracks.filter((t) => t.id !== id) });
  },
}));
