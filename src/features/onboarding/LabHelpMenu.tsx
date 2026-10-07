'use client';

import { useState } from 'react';
import { CircleHelp, Play } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Kbd } from '@/ui/primitives/Kbd';
import { Popover } from '@/ui/primitives/Popover';
import { openWalkthrough } from '@/ui/walkthrough/walkStore';

/** Lets the popover finish closing and hand focus back before the tour takes it. */
const REPLAY_DELAY_MS = 120;

/** A lab's help menu: its keyboard shortcuts and a button that replays the lab's tour. */
export function LabHelpMenu({ tour, shortcuts }: { tour: string; shortcuts: ReadonlyArray<readonly [string, string]> }) {
  const [open, setOpen] = useState(false);
  const replay = () => {
    setOpen(false);
    setTimeout(() => openWalkthrough(tour), REPLAY_DELAY_MS);
  };
  return (
    <Popover
      side="top"
      align="end"
      open={open}
      onOpenChange={setOpen}
      label="Help and shortcuts"
      trigger={
        <Button size="icon" variant="ghost" aria-label="Help and shortcuts" data-tour="help">
          <CircleHelp />
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold">Keyboard shortcuts</h3>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[12px]">
          {shortcuts.map(([key, label]) => (
            <div key={key} className="contents">
              <dt>
                <Kbd>{key}</Kbd>
              </dt>
              <dd className="text-muted">{label}</dd>
            </div>
          ))}
        </dl>
        <Button size="sm" variant="outline" onClick={replay}>
          <Play />
          Replay the tour
        </Button>
      </div>
    </Popover>
  );
}
