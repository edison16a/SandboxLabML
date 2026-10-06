'use client';

import { useMemo } from 'react';
import type { InputSpec } from '@/engine/env/types';
import { racingInputSchema } from '@/engine/racing/sensors/inputSchema';
import { compileScript } from '@/engine/script';
import { scriptAt } from '@/engine/training/runConfig';
import { useRacingLab } from '../state/labStore';

/**
 * The input schema of the open run, including the script's own sensors, so
 * the overlay, the inputs tab and the network labels line up with what the
 * brain actually receives.
 */
export function useRunSchema(): InputSpec[] {
  const run = useRacingLab((s) => s.run);
  const gen = useRacingLab((s) => s.liveGeneration);
  const source = run ? (scriptAt(run, gen)?.source ?? null) : null;
  return useMemo(() => {
    if (!run || run.blueprint.env !== 'racing' || !run.racing) return [];
    const custom = source ? (compileScript(source).script?.sensors ?? []) : [];
    return racingInputSchema(run.blueprint.inputs, run.racing.car, custom);
  }, [run, source]);
}
