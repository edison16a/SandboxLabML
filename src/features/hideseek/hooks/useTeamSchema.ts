'use client';

import { useCallback, useMemo } from 'react';
import type { InputSpec } from '@/engine/env/types';
import { hideSeekInputSchema } from '@/engine/hideseek/sensing/inputSchema';
import { hideSeekBlueprints, hideSeekSettingsOf } from '@/engine/training/hideseekRunConfig';
import { inspectedArena } from './useHideSeekInspect';
import { hideSeekSession } from '../session/HideSeekSession';
import { useHideSeekLab } from '../state/hideSeekStore';
import type { AgentSlot } from '../state/types';

/** Input schemas of both teams for the open run, hider first. Empty before a run is open. */
export function useTeamSchemas(): [InputSpec[], InputSpec[]] {
  const run = useHideSeekLab((s) => s.run);
  return useMemo(() => {
    if (!run || run.env !== 'hideseek') return [[], []];
    const bp = hideSeekBlueprints(run);
    const physics = hideSeekSettingsOf(run).physics;
    return [hideSeekInputSchema(bp.hider.inputs, physics), hideSeekInputSchema(bp.seeker.inputs, physics)];
  }, [run]);
}

/**
 * Reads the latest inputs and outputs of one agent of the inspected arena
 * from the feed on screen, or null when that agent is not the one being
 * streamed right now.
 */
export function useInspectReader(agent: AgentSlot): () => { obs: Float32Array; out: Float32Array } | null {
  return useCallback(() => {
    const inspect = hideSeekSession().feed()?.inspect;
    const want = inspectedArena(useHideSeekLab.getState().focus) * 2 + agent;
    return inspect && inspect.index === want ? inspect : null;
  }, [agent]);
}
