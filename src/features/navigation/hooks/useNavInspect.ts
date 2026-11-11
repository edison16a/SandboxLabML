'use client';

import { useEffect } from 'react';
import { navigationSession } from '../session/NavigationSession';
import { useNavigationLab } from '../state/labStore';

/**
 * Tells the workers whose inputs to send: the runner the viewport follows,
 * in whichever stream it is in, while the Inputs overlay, the Inputs tab
 * or the Network tab needs them. Only that one runner streams its inputs,
 * so a frame stays small, and the sensors drawn are the ones its brain got.
 */
export function useNavInspect(ready: boolean) {
  const overlay = useNavigationLab((s) => s.inputsOverlay);
  const tab = useNavigationLab((s) => s.panelTab);
  const followed = useNavigationLab((s) => s.followed);
  const ghost = useNavigationLab((s) => s.inspectStream === 'ghosts');
  useEffect(() => {
    const streams = navigationSession().streams;
    if (!ready || !streams) return;
    const wanted = (overlay || tab === 'inputs' || tab === 'network') && followed >= 0;
    streams.population.subscribe(wanted && !ghost ? followed : null, false);
    streams.ghosts.subscribe(wanted && ghost ? followed : null, false);
  }, [ready, overlay, tab, followed, ghost]);
}
