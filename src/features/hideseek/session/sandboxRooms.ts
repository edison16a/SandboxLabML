import { isPresetRoomId, presetRoom, SANDBOX_LIMITS, type SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { deleteSandboxRoom, listSandboxRooms, newRoomId, saveSandboxRoom } from '@/storage/sandboxRooms';
import { getSetting, setSetting } from '@/storage/settings';
import { useHideSeekLab } from '../state/hideSeekStore';

/** Settings key for the Sandbox setup that comes back next visit. */
const PREFS_KEY = 'hideseek.sandbox';

interface SandboxPrefs {
  roomId: string;
  hiders: number;
  seekers: number;
}

const store = () => useHideSeekLab.getState();

let loaded: Promise<void> | null = null;

/** The room with this id: a preset, one of the user's rooms, or Shelter when it is gone. */
export function roomById(id: string, rooms: readonly SandboxRoom[]): SandboxRoom {
  if (isPresetRoomId(id)) return presetRoom(id);
  return rooms.find((r) => r.id === id) ?? presetRoom('shelter');
}

const count = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(1, Math.min(SANDBOX_LIMITS.playersPerTeam, Math.round(n))) : fallback);

/**
 * Reads the user's rooms and the last Sandbox setup (room and player
 * counts) from storage, once per page load. A failure leaves the presets
 * and defaults in place: the Sandbox still works without storage.
 */
export function loadSandboxRooms(): Promise<void> {
  loaded ??= (async () => {
    try {
      const [rooms, prefs] = await Promise.all([listSandboxRooms(), getSetting<SandboxPrefs>(PREFS_KEY)]);
      const s = store().sandbox;
      const roomId = prefs && (isPresetRoomId(prefs.roomId) || rooms.some((r) => r.id === prefs.roomId)) ? prefs.roomId : s.roomId;
      store().setSandbox({ rooms, roomId, hiders: count(prefs?.hiders, s.hiders), seekers: count(prefs?.seekers, s.seekers) });
    } catch {
      loaded = null;
    }
  })();
  return loaded;
}

/** Remembers the room and player counts for next time. Best effort. */
export function rememberSandboxSetup(): void {
  const { roomId, hiders, seekers } = store().sandbox;
  void setSetting(PREFS_KEY, { roomId, hiders, seekers } satisfies SandboxPrefs).catch(() => {});
}

/** A new room to edit, copied from `from` (walls, boxes and spawns) under a fresh id and name. */
export function draftRoom(from: SandboxRoom): SandboxRoom {
  const taken = new Set(store().sandbox.rooms.map((r) => r.name));
  let k = store().sandbox.rooms.length + 1;
  while (taken.has(`Room ${k}`)) k++;
  return { ...structuredClone(from), id: newRoomId(), name: `Room ${k}` };
}

/** Saves a room and puts it in the picker, in place when it already was there. */
export async function storeRoom(room: SandboxRoom): Promise<SandboxRoom> {
  const saved = await saveSandboxRoom(room);
  const rooms = store().sandbox.rooms;
  const next = rooms.some((r) => r.id === saved.id) ? rooms.map((r) => (r.id === saved.id ? saved : r)) : [...rooms, saved];
  store().setSandbox({ rooms: next });
  return saved;
}

/** Deletes a room. If it was in play, Shelter takes its place. Returns whether the room in play changed. */
export async function dropRoom(id: string): Promise<boolean> {
  await deleteSandboxRoom(id);
  const s = store().sandbox;
  const inPlay = s.roomId === id;
  store().setSandbox({ rooms: s.rooms.filter((r) => r.id !== id), ...(inPlay ? { roomId: 'shelter' } : {}) });
  if (inPlay) rememberSandboxSetup();
  return inPlay;
}
