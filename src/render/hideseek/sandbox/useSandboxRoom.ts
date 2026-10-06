'use client';

import { useMemo } from 'react';
import { roomById, type SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';

/**
 * The room the Sandbox plays in, from the lab store. It goes through the
 * same roomById the session builds the match with, so walls and players
 * always agree.
 */
export function useSandboxRoom(): SandboxRoom {
  const id = useHideSeekLab((s) => s.sandbox.roomId);
  const rooms = useHideSeekLab((s) => s.sandbox.rooms);
  return useMemo(() => roomById(id, rooms), [id, rooms]);
}
