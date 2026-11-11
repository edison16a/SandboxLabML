'use client';

import { useEffect } from 'react';
import type { WorkerPool } from '@/workers/client/workerPool';
import { shownStream } from '../session/shown';
import { useDrivingLab } from '../state/labStore';

/**
 * Tells the workers whose inputs to send: exactly the SUV the viewport
 * follows, in the stream it shows. The worker's own idea of the leader can
 * differ from the camera's (which holds on to a car until another is well
 * ahead), so the index comes from the viewport, not from "whoever leads".
 * Only while something shows the inputs: the overlay, the Inputs tab or the
 * Network tab.
 */
export function useDrivingInspect(streams: Pick<WorkerPool, 'population' | 'ghosts'> | null) {
  const overlay = useDrivingLab((s) => s.inputsOverlay);
  const tab = useDrivingLab((s) => s.panelTab);
  const followed = useDrivingLab((s) => s.followed);
  const shown = useDrivingLab(shownStream);
  useEffect(() => {
    if (!streams) return;
    const wanted = (overlay || tab === 'inputs' || tab === 'network') && followed >= 0;
    streams.population.subscribe(wanted && shown === 'population' ? followed : null, false);
    streams.ghosts.subscribe(wanted && shown === 'ghosts' ? followed : null, false);
  }, [streams, overlay, tab, followed, shown]);
}
