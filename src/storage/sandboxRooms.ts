import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { sanitizeRoom } from '@/engine/hideseek/sandbox/validate';
import { newRunId } from '@/engine/training/runConfig';
import { db } from './db';

/** A fresh id for a room the user starts drawing. */
export function newRoomId(): string {
  return `room-${newRunId()}`;
}

/** The user's own Sandbox rooms, oldest first so the picker keeps them in place. Broken rows are skipped. */
export async function listSandboxRooms(): Promise<SandboxRoom[]> {
  const rows = await db().sandboxRooms.orderBy('createdAt').toArray();
  return rows.map((r) => sanitizeRoom({ ...(r.room as object), id: r.id })).filter((r): r is SandboxRoom => r !== null);
}

/** Saves a room, keeping when it was first made. Returns the room as stored, cleaned. */
export async function saveSandboxRoom(room: SandboxRoom): Promise<SandboxRoom> {
  const clean = sanitizeRoom(room);
  if (!clean) throw new Error('That is not a room that can be saved.');
  const now = Date.now();
  const d = db();
  await d.transaction('rw', d.sandboxRooms, async () => {
    const old = await d.sandboxRooms.get(clean.id);
    await d.sandboxRooms.put({ id: clean.id, room: clean, createdAt: old?.createdAt ?? now, updatedAt: now });
  });
  return clean;
}

export async function deleteSandboxRoom(id: string): Promise<void> {
  await db().sandboxRooms.delete(id);
}
