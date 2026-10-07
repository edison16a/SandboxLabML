'use client';

import { CircleHelp } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Kbd } from '@/ui/primitives/Kbd';
import { Popover } from '@/ui/primitives/Popover';
import { useRacingLab } from '../state/labStore';

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Train or pause'],
  ['R', 'Restart the race'],
  ['S', 'Run one generation'],
  ['1 to 5', 'Speed: 1x, 2x, 4x, Turbo, Max'],
  ['I', 'Inputs overlay'],
  ['V', 'Population, overlay or both'],
  ['C', 'Next camera'],
  ['N', 'New run'],
  ['Esc', 'Follow the leader again'],
];

/** Keyboard shortcuts and a way to replay the tour. */
export function HelpMenu() {
  const set = useRacingLab((s) => s.set);
  return (
    <Popover
      side="top"
      align="end"
      trigger={
        <Button size="icon" variant="ghost" aria-label="Help and shortcuts">
          <CircleHelp />
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold">Keyboard shortcuts</h3>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[12px]">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="contents">
              <dt>
                <Kbd>{key}</Kbd>
              </dt>
              <dd className="text-muted">{label}</dd>
            </div>
          ))}
        </dl>
        <Button size="sm" variant="outline" onClick={() => set({ tourSignal: useRacingLab.getState().tourSignal + 1 })}>
          Replay the tour
        </Button>
      </div>
    </Popover>
  );
}
