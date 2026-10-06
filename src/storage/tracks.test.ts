import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RING_TRACK } from '@/engine/racing/track/presets';
import { SandboxDb, setDb } from './db';
import { deleteTrack, listTracks, restoreTrack, saveTrack, SAVED_TRACK_PREFIX } from './tracks';

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

  it('puts a deleted track back with its id and place in the list', async () => {
    const older = await saveTrack('Older', RING_TRACK);
    await new Promise((r) => setTimeout(r, 5));
    const newer = await saveTrack('Newer', RING_TRACK);
    const row = await deleteTrack(older.id);
    expect(row?.spec).toEqual(older);
    expect(await deleteTrack(older.id)).toBeUndefined();
    await new Promise((r) => setTimeout(r, 5));
    if (row) await restoreTrack(row);
    expect((await listTracks()).map((t) => t.id)).toEqual([newer.id, older.id]);
  });

  /**
   * A database left by an older build, with one row to keep. `withV3` builds
   * one that already reached version 3 with none of today's version 3 tables,
   * like a build of a branch that added a different one.
   */
  async function oldDatabase(withV3: boolean): Promise<string> {
    const name = `old-${n++}`;
    const old = new Dexie(name);
    old.version(1).stores({ runs: 'id, env, updatedAt, deletedAt', settings: 'key' });
    old.version(2).stores({ hsGenerations: '[runId+generation], runId' });
    if (withV3) old.version(3).stores({});
    await old.table('settings').put({ key: 'kept', value: 1 });
    old.close();
    return name;
  }

  /** Opens the old database with today's schema and checks every declared table exists and the row survived. */
  async function expectUpgraded(name: string) {
    const upgraded = new SandboxDb(name);
    setDb(upgraded);
    expect(await listTracks()).toEqual([]);
    expect([...upgraded.backendDB().objectStoreNames].sort()).toEqual(upgraded.tables.map((t) => t.name).sort());
    expect(await upgraded.settings.get('kept')).toEqual({ key: 'kept', value: 1 });
  }

  it('upgrades a version 2 database to every table and keeps its rows', async () => {
    await expectUpgraded(await oldDatabase(false));
  });

  it('adds missing tables to a version 3 database made without them', async () => {
    // Dexie warns that the schema grew without a version bump, then adds the tables.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expectUpgraded(await oldDatabase(true));
    warn.mockRestore();
  });
});
