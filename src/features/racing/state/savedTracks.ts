import { create } from 'zustand';
import type { TrackSpec } from '@/engine/racing/track/types';
import { deleteTrack, listTracks, saveTrack } from '@/storage/tracks';

interface SavedTracksState {
  tracks: TrackSpec[];
  loaded: boolean;
  /** Reads the list once per page load; later calls are free. */
  load: () => Promise<void>;
  save: (name: string, spec: TrackSpec) => Promise<TrackSpec>;
  remove: (id: string) => Promise<void>;
}

/** The user's saved tracks, shared by the Sandbox gallery and the new run dialog. */
export const useSavedTracks = create<SavedTracksState>((set, get) => ({
  tracks: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    set({ tracks: await listTracks(), loaded: true });
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
