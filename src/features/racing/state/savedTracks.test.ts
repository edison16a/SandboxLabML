import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RING_TRACK } from '@/engine/racing/track/presets';
import type { TrackSpec } from '@/engine/racing/track/types';
import { useSavedTracks } from './savedTracks';

/** Each list read waits here until the test hands it rows, so a test can act while a read is out. */
const reads = vi.hoisted(() => [] as Array<(rows: TrackSpec[]) => void>);

vi.mock('@/storage/tracks', () => ({
  listTracks: () => new Promise<TrackSpec[]>((resolve) => reads.push(resolve)),
  saveTrack: async (name: string, spec: TrackSpec) => ({ ...spec, id: `saved-${name}`, name }),
  deleteTrack: async () => undefined,
  restoreTrack: async () => undefined,
}));

const track = (name: string): TrackSpec => ({ ...RING_TRACK, id: `saved-${name}`, name });
const names = () => useSavedTracks.getState().tracks.map((t) => t.name);

beforeEach(() => {
  reads.length = 0;
  useSavedTracks.getState().reset();
});

describe('saved track list', () => {
  it('keeps a track saved while the first read was out, once', async () => {
    const store = useSavedTracks.getState();
    const loading = store.load();
    await store.save('Mine', RING_TRACK);
    expect(names()).toEqual(['Mine']);
    // The read may or may not have seen the new row; either way it shows once, on top.
    reads[0]([track('Mine'), track('Older')]);
    await loading;
    expect(names()).toEqual(['Mine', 'Older']);
    expect(useSavedTracks.getState().loaded).toBe(true);
  });

  it('reads again after a reset, and drops a read that was out at the time', async () => {
    const store = useSavedTracks.getState();
    const first = store.load();
    reads[0]([track('Old')]);
    await first;
    expect(names()).toEqual(['Old']);

    // Delete all data empties storage; the stale list goes with it.
    store.reset();
    expect(useSavedTracks.getState()).toMatchObject({ tracks: [], loaded: false });
    const second = store.load();
    store.reset();
    reads[1]([track('Old')]);
    await second;
    expect(useSavedTracks.getState()).toMatchObject({ tracks: [], loaded: false });

    const third = store.load();
    reads[2]([]);
    await third;
    expect(useSavedTracks.getState()).toMatchObject({ tracks: [], loaded: true });
  });
});
