import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { RING_TRACK } from '@/engine/racing/track/presets';
import { SandboxDb, setDb } from './db';
import { deleteTrack, listTracks, saveTrack, SAVED_TRACK_PREFIX } from './tracks';

let n = 0;
beforeEach(() => setDb(new SandboxDb(`tracks-${n++}`)));

describe('saved tracks', () => {
  it('saves, lists newest first and deletes', async () => {
    const a = await saveTrack('  Kidney  ', RING_TRACK);
    await new Promise((r) => setTimeout(r, 5));
    const b = await saveTrack('Long loop', { ...RING_TRACK, width: 12 });
    expect(a.id.startsWith(SAVED_TRACK_PREFIX)).toBe(true);
    expect(a.name).toBe('Kidney');
    expect((await listTracks()).map((t) => t.name)).toEqual(['Long loop', 'Kidney']);
    expect((await listTracks())[0]).toEqual(b);
    await deleteTrack(a.id);
    expect((await listTracks()).map((t) => t.id)).toEqual([b.id]);
  });

  it('replaces a track saved again under the same name', async () => {
    const first = await saveTrack('Loop', RING_TRACK);
    const second = await saveTrack('loop', { ...RING_TRACK, width: 8 });
    expect(second.id).toBe(first.id);
    const list = await listTracks();
    expect(list).toHaveLength(1);
    expect(list[0].width).toBe(8);
  });

  it('upgrades a database made before the tracks table existed and keeps its rows', async () => {
    const name = `old-${n++}`;
    const old = new Dexie(name);
    old.version(1).stores({ runs: 'id, env, updatedAt, deletedAt', settings: 'key' });
    old.version(2).stores({ hsGenerations: '[runId+generation], runId' });
    await old.table('settings').put({ key: 'kept', value: 1 });
    old.close();
    const upgraded = new SandboxDb(name);
    setDb(upgraded);
    expect(await listTracks()).toEqual([]);
    expect(await upgraded.settings.get('kept')).toEqual({ key: 'kept', value: 1 });
  });
});
