'use client';

import { useMemo } from 'react';
import type { InputSpec } from '@/engine/env/types';
import { compileScript } from '@/engine/script';
import { scriptAt } from '@/engine/training/runConfig';
import { useLab, useLabContext } from '../LabContext';

/**
 * The input schema of the open run, including the script's own sensors, so
 * the overlay, the inputs tab and the network labels line up with what the
 * brain actually receives.
 */
export function useRunSchema(): InputSpec[] {
  const { module } = useLabContext();
  const run = useLab((s) => s.run);
  const gen = useLab((s) => s.liveGeneration);
  const source = run ? (scriptAt(run, gen)?.source ?? null) : null;
  return useMemo(() => {
    if (!run || run.env !== module.id || run.blueprint.env !== module.id) return [];
    const custom = source ? (compileScript(source).script?.sensors ?? []) : [];
    return module.inputSchema(run, custom);
  }, [module, run, source]);
}
