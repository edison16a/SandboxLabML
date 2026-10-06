'use client';

import { useEffect, useState } from 'react';
import { listPresets, listScripts, type ScriptEntry } from '@/storage/scripts';
import { useStudio } from '../state/studioStore';

/** The user's scripts and the presets for the env filter, reloaded whenever a storage action bumps the list version. */
export function useScriptLists(): { mine: ScriptEntry[]; presets: ScriptEntry[]; loading: boolean } {
  const filter = useStudio((s) => s.envFilter);
  const version = useStudio((s) => s.listVersion);
  const [mine, setMine] = useState<ScriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    listScripts(filter === 'all' ? undefined : filter)
      .then((rows) => live && setMine(rows))
      .catch(() => live && setMine([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [filter, version]);
  return { mine, presets: listPresets(filter === 'all' ? undefined : filter), loading };
}
