'use client';

import { Gauge, Zap } from 'lucide-react';
import { Segmented } from '@/ui/primitives/Segmented';
import { Tooltip } from '@/ui/primitives/Tooltip';
import type { SpeedMode } from '@/workers/shared/protocol';

const OPTIONS: Array<{ value: SpeedMode; label: React.ReactNode; title: string }> = [
  { value: '1x', label: '1x', title: 'Real time. Every arena of the round plays live.' },
  { value: '2x', label: '2x', title: 'Twice real time' },
  { value: '4x', label: '4x', title: 'Four times real time' },
  {
    value: 'turbo',
    label: (
      <>
        <Zap />
        Turbo
      </>
    ),
    title: 'Train headless on every core. The grid replays the latest round at real time.',
  },
  {
    value: 'max',
    label: (
      <>
        <Gauge />
        Max
      </>
    ),
    title: 'Train headless and stop the replay for the last bit of speed.',
  },
];

/** The speed selector. Watch speeds stream the live round; Turbo and Max train headless. */
export function HsSpeedBar({ value, onChange }: { value: SpeedMode; onChange: (v: SpeedMode) => void }) {
  return (
    <Tooltip content="Simulation speed" shortcut="1 to 5">
      <span>
        <Segmented label="Simulation speed" value={value} options={OPTIONS} onChange={onChange} />
      </span>
    </Tooltip>
  );
}
