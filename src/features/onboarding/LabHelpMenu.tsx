'use client';

import { useState } from 'react';
import { CircleHelp, Play } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Kbd } from '@/ui/primitives/Kbd';
import { Popover } from '@/ui/primitives/Popover';
import { useTourReplay } from './useTourReplay';

/** A lab's help menu: its keyboard shortcuts and a button that replays the lab's tour. */
export function LabHelpMenu({ tour, shortcuts }: { tour: string; shortcuts: ReadonlyArray<readonly [string, string]> }) {
  const [open, setOpen] = useState(false);
  const { button, onCloseAutoFocus, replay } = useTourReplay(tour);
  return (
    <Popover
      side="top"
      align="end"
      open={open}
      onOpenChange={setOpen}
      onCloseAutoFocus={onCloseAutoFocus}
      label="Help and shortcuts"
      trigger={
        <Button ref={button} size="icon" variant="ghost" aria-label="Help and shortcuts">
          <CircleHelp />
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold">Keyboard shortcuts</h3>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[12px]">
          {shortcuts.map(([key, label]) => (
            // A key can appear twice (Space trains, and plays the Sandbox), so the row is keyed by both.
            <div key={`${key}:${label}`} className="contents">
              <dt>
                <Kbd>{key}</Kbd>
              </dt>
              <dd className="text-muted">{label}</dd>
            </div>
          ))}
        </dl>
        <Button size="sm" variant="outline" onClick={() => replay(() => setOpen(false))}>
          <Play />
          Replay the tour
        </Button>
      </div>
    </Popover>
  );
}
