'use client';

import { useEffect } from 'react';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';

/**
 * Tells the workers which agent's inputs to send. Only the inspected agent
 * streams its input vector, so the cost stays under a kilobyte per frame;
 * "all cars" adds every car's ray readings.
 */
export function useInspectSubscription(ready: boolean) {
  const overlay = useRacingLab((s) => s.inputsOverlay);
  const scope = useRacingLab((s) => s.inputsScope);
  const tab = useRacingLab((s) => s.panelTab);
  const focus = useRacingLab((s) => s.focus);
  const ghostGens = useRacingLab((s) => s.ghostGenerations);
  useEffect(() => {
    const streams = racingSession().streams;
    if (!ready || !streams) return;
    const wanted = overlay || tab === 'inputs' || tab === 'network';
    const popIndex = !wanted ? null : focus.kind === 'car' ? focus.index : -1;
    streams.population.subscribe(popIndex, overlay && scope === 'all');
    const ghostIndex = wanted ? (focus.kind === 'ghost' ? ghostGens.indexOf(focus.generation) : ghostGens.length - 1) : null;
    streams.ghosts.subscribe(ghostIndex !== null && ghostIndex >= 0 ? ghostIndex : null, false);
  }, [ready, overlay, scope, tab, focus, ghostGens]);
}
