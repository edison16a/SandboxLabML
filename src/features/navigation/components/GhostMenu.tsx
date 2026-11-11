'use client';

import { Ghost } from 'lucide-react';
import { GhostSelectionFields } from '@/features/lab/components/GhostSelectionFields';
import { glass } from '@/features/lab/components/ViewportControls';
import type { GhostSelection } from '@/features/lab/session/ghostSelection';
import { Button } from '@/ui/primitives/Button';
import { Popover } from '@/ui/primitives/Popover';
import { navigationSession } from '../session/NavigationSession';
import { useNavigationLab } from '../state/labStore';

/** Which past champions run along as ghosts, on the course the population runs now. */
export function GhostMenu() {
  const sel = useNavigationLab((s) => s.ghostSelection);
  const shown = useNavigationLab((s) => s.ghostGenerations);
  const apply = (next: GhostSelection) => {
    useNavigationLab.getState().set({ ghostSelection: next });
    void navigationSession().refreshGhosts();
  };
  return (
    <Popover
      align="end"
      trigger={
        <Button size="sm" variant="secondary" className={glass}>
          <Ghost />
          Ghosts {shown.length > 0 && <span className="text-white/60">{shown.length}</span>}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <GhostSelectionFields value={sel} shown={shown} onChange={apply} />
        <p className="text-[12px] text-subtle">Each one replays its brain on the course the population runs now.</p>
      </div>
    </Popover>
  );
}
