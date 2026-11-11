'use client';

import { useEffect } from 'react';
import { useLab, useLabContext } from '../LabContext';

/**
 * Tells the workers which agent's inputs to send. Only the inspected agent
 * streams its input vector, so the cost stays under a kilobyte per frame;
 * "all" adds every agent's ray readings.
 */
export function useInspectSubscription(ready: boolean) {
  const { session } = useLabContext();
  const overlay = useLab((s) => s.inputsOverlay);
  const scope = useLab((s) => s.inputsScope);
  const tab = useLab((s) => s.panelTab);
  const focus = useLab((s) => s.focus);
  const ghostGens = useLab((s) => s.ghostGenerations);
  useEffect(() => {
    const streams = session.streams;
    if (!ready || !streams) return;
    const wanted = overlay || tab === 'inputs' || tab === 'network';
    const popIndex = !wanted ? null : focus.kind === 'car' ? focus.index : -1;
    streams.population.subscribe(popIndex, overlay && scope === 'all');
    // Ghosts are found by their champion's first agent, the same one the camera follows.
    const followed = focus.kind === 'ghost' ? focus.generation : ghostGens[ghostGens.length - 1];
    const ghostIndex = wanted ? ghostGens.indexOf(followed) : null;
    streams.ghosts.subscribe(ghostIndex !== null && ghostIndex >= 0 ? ghostIndex : null, false);
  }, [session, ready, overlay, scope, tab, focus, ghostGens]);
}
