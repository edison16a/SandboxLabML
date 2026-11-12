'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { HardDrive } from 'lucide-react';
import { Badge } from '@/ui/primitives/Badge';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { useLabContext } from '../LabContext';
import { SAVE_BACKLOG } from '../session/runSaver';

/**
 * Shows while finished generations wait to be saved, which happens when
 * Turbo or Max trains faster than a busy machine can write. Closing the
 * tab then would lose them, and the browser asks first (see pageGuard).
 */
export function SavingChip() {
  const { saves } = useLabContext().session;
  const subscribe = useCallback((listener: () => void) => saves.subscribe(listener), [saves]);
  const saving = useSyncExternalStore(
    subscribe,
    () => saves.backlog >= SAVE_BACKLOG,
    () => false,
  );
  if (!saving) return null;
  return (
    <Tooltip content="Saving finished generations to this browser. Closing the tab now would lose them.">
      <span>
        <Badge>
          <HardDrive className="size-3" aria-hidden />
          Saving
        </Badge>
      </span>
    </Tooltip>
  );
}
