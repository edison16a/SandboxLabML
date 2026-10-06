'use client';

import { useEffect } from 'react';
import { hideSeekSession } from '../session/HideSeekSession';
import { useHideSeekLab } from '../state/hideSeekStore';

/** Arena the panels and the POV cameras follow: the focused one, or the first. */
export function inspectedArena(focus: number | null): number {
  return focus ?? 0;
}

/**
 * Tells the workers what to send beyond positions. Only the inspected agent
 * streams its input vector, a few hundred bytes a frame; ray hit points for
 * every arena are sent only while the overlay shows them.
 */
export function useHideSeekInspect(ready: boolean) {
  const overlay = useHideSeekLab((s) => s.inputsOverlay);
  const scope = useHideSeekLab((s) => s.inputsScope);
  const tab = useHideSeekLab((s) => s.panelTab);
  const focus = useHideSeekLab((s) => s.focus);
  const agent = useHideSeekLab((s) => s.inspectAgent);
  const mode = useHideSeekLab((s) => s.mode);
  useEffect(() => {
    const streams = hideSeekSession().streams;
    if (!ready || !streams) return;
    const wanted = overlay || tab === 'inputs' || tab === 'network' || mode === 'sandbox';
    const index = wanted ? inspectedArena(focus) * 2 + agent : null;
    const rays = overlay && (scope === 'all' || focus === null);
    streams.live.subscribe(index, rays);
    streams.replayed.subscribe(index, rays);
    // The Sandbox shows one match, so the inspected team is the whole address.
    streams.sandbox.subscribe(wanted ? agent : null, false);
  }, [ready, overlay, scope, tab, focus, agent, mode]);
}
