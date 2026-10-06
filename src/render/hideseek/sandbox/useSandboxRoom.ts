'use client';

import { useMemo } from 'react';
import { isPresetRoomId, presetRoom, type SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';

/**
 * The room the Sandbox plays in, from the lab store: a preset, one of the
 * user's rooms, or Shelter when the picked one is gone. The same rule the
 * session uses to build the match, so walls and players always agree.
 */
export function useSandboxRoom(): SandboxRoom {
  const id = useHideSeekLab((s) => s.sandbox.roomId);
  const rooms = useHideSeekLab((s) => s.sandbox.rooms);
  return useMemo(() => (isPresetRoomId(id) ? presetRoom(id) : (rooms.find((r) => r.id === id) ?? presetRoom('shelter'))), [id, rooms]);
}
