'use client';

import { useRef, useState } from 'react';
import { CircleHelp, Play } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Kbd } from '@/ui/primitives/Kbd';
import { Popover } from '@/ui/primitives/Popover';
import { openWalkthrough } from '@/ui/walkthrough/walkStore';

/** A lab's help menu: its keyboard shortcuts and a button that replays the lab's tour. */
export function LabHelpMenu({ tour, shortcuts }: { tour: string; shortcuts: ReadonlyArray<readonly [string, string]> }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const replaying = useRef(false);
  // The tour opens once the menu has closed, in place of the menu handing focus back to its button.
  // Opening it any sooner, the menu could take focus back from the tour's card a moment later.
  const onCloseAutoFocus = (event: Event) => {
    if (!replaying.current) return;
    replaying.current = false;
    event.preventDefault();
    openWalkthrough(tour, button.current);
  };
  const replay = () => {
    replaying.current = true;
    setOpen(false);
  };
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
