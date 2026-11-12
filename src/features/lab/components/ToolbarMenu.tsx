'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ellipsis, FlaskConical, FolderOpen, Play, Plus } from 'lucide-react';
import { useTourReplay } from '@/features/onboarding/useTourReplay';
import { Button } from '@/ui/primitives/Button';
import { Popover } from '@/ui/primitives/Popover';
import type { SandboxSwitch } from './SandboxButton';

const item = 'w-full justify-start';

/**
 * The toolbar's actions on a narrow screen, where the row has no room for
 * them: the Sandbox, a new run, the Runs page and the tour. Keyboard
 * shortcuts are left out, since a phone has no keyboard to use them with.
 * It carries the Sandbox's tour mark, so the tour points here on a phone.
 */
export function ToolbarMenu({ sandbox, tour, onNewRun }: { sandbox: SandboxSwitch; tour: string; onNewRun: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { button, onCloseAutoFocus, replay } = useTourReplay(tour);
  const then = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <Popover
      side="top"
      align="end"
      className="w-56 p-1.5"
      open={open}
      onOpenChange={setOpen}
      onCloseAutoFocus={onCloseAutoFocus}
      label="More actions"
      trigger={
        <Button ref={button} size="icon" variant={sandbox.open ? 'primary' : 'outline'} aria-label="More actions" data-tour="sandbox">
          <Ellipsis />
        </Button>
      }
    >
      <div className="flex flex-col gap-0.5">
        <Button variant="ghost" className={item} disabled={sandbox.disabled} onClick={then(sandbox.toggle)}>
          <FlaskConical />
          {sandbox.open ? 'Close the Sandbox' : 'Open the Sandbox'}
        </Button>
        <Button variant="ghost" className={item} onClick={then(onNewRun)}>
          <Plus />
          New run
        </Button>
        <Button variant="ghost" className={item} onClick={then(() => router.push('/runs'))}>
          <FolderOpen />
          All runs
        </Button>
        <Button variant="ghost" className={item} onClick={() => replay(() => setOpen(false))}>
          <Play />
          Replay the tour
        </Button>
      </div>
    </Popover>
  );
}
