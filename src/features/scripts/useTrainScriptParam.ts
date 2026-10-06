'use client';

import { useEffect, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import type { EnvId } from '@/engine/env/types';
import { getScript } from '@/storage/scripts';
import { choiceFromSource, type BlueprintOf, type ScriptChoice } from './scriptChoice';

/**
 * Studio's Train button opens a lab with ?trainScript=<id>. This loads that
 * script, compiles it for the lab's environment and hands it back with a
 * call to open the New run dialog. A script with errors or for the other
 * lab is ignored, so a stale link just opens the lab.
 */
export function useTrainScriptParam<E extends EnvId>(env: E, params: ReadonlyURLSearchParams, open: () => void): ScriptChoice<BlueprintOf<E>> | undefined {
  const [pending, setPending] = useState<ScriptChoice<BlueprintOf<E>> | undefined>();
  useEffect(() => {
    const id = params.get('trainScript');
    if (!id) return;
    void getScript(id).then((entry) => {
      const choice = entry ? choiceFromSource(env, entry.id, entry.name, entry.source) : null;
      if (!choice) return;
      setPending(choice);
      open();
    });
  }, [env, params, open]);
  return pending;
}
