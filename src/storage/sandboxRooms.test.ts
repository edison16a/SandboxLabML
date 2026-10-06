import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyRoom, presetRoom } from '@/engine/hideseek/sandbox/room';
import { SandboxDb, setDb } from './db';
import { deleteSandboxRoom, listSandboxRooms, newRoomId, saveSandboxRoom } from './sandboxRooms';

let n = 0;
beforeEach(() => setDb(new SandboxDb(`rooms-${n++}`)));

describe('Sandbox rooms in storage', () => {
  it('saves, lists in creation order, updates in place and deletes', async () => {
    const a = { ...presetRoom('shelter'), id: newRoomId(), name: 'Fort' };
    const b = { ...emptyRoom(newRoomId(), 'Maze'), walls: [{ from: [0, -10], to: [0, 4] }] as typeof a.walls };
    await saveSandboxRoom(a);
    await saveSandboxRoom(b);
    expect((await listSandboxRooms()).map((r) => r.name)).toEqual(['Fort', 'Maze']);
    await saveSandboxRoom({ ...a, name: 'Fort 2', boxes: [] });
    const rooms = await listSandboxRooms();
    expect(rooms.map((r) => r.name)).toEqual(['Fort 2', 'Maze']);
    expect(rooms[0].boxes).toEqual([]);
    expect(rooms[1].walls).toEqual(b.walls);
    await deleteSandboxRoom(a.id);
    expect((await listSandboxRooms()).map((r) => r.id)).toEqual([b.id]);
  });

  it('opens a version 2 database and keeps its data while adding the rooms table', async () => {
    const name = `upgrade-${n++}`;
    const old = new Dexie(name);
    old.version(1).stores({ runs: 'id, env, updatedAt, deletedAt', settings: 'key' });
    old.version(2).stores({ hsGenerations: '[runId+generation], runId' });
    await old.open();
    await old.table('settings').put({ key: 'k', value: 7 });
    old.close();
    const next = new SandboxDb(name);
    setDb(next);
    expect((await next.settings.get('k'))?.value).toBe(7);
    await saveSandboxRoom(emptyRoom('r1', 'New'));
    expect(await listSandboxRooms()).toHaveLength(1);
  });
});
