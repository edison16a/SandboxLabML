'use client';

import { Gauge, Zap } from 'lucide-react';
import { Segmented } from '@/ui/primitives/Segmented';
import { Tooltip } from '@/ui/primitives/Tooltip';
import type { SpeedMode } from '@/workers/shared/protocol';

const OPTIONS: Array<{ value: SpeedMode; label: React.ReactNode; title: string }> = [
  { value: '1x', label: '1x', title: 'Real time' },
  { value: '2x', label: '2x', title: 'Twice real time' },
  { value: '4x', label: '4x', title: 'Four times real time' },
  { value: 'turbo', label: <><Zap />Turbo</>, title: 'Train flat out on every core. The viewport loops recent champions.' },
  { value: 'max', label: <><Gauge />Max</>, title: 'Train flat out and pause the viewport for the last bit of speed.' },
];

/** The speed selector. Watch speeds show the live generation; Turbo and Max run headless. */
export function SpeedBar({ value, onChange }: { value: SpeedMode; onChange: (v: SpeedMode) => void }) {
  return (
    <Tooltip content="Simulation speed" shortcut="1 to 5">
      <span>
        <Segmented label="Simulation speed" value={value} options={OPTIONS} onChange={onChange} />
      </span>
    </Tooltip>
  );
}
