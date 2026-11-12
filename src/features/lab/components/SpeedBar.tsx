'use client';

import { Check, ChevronUp, Gauge, Zap } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Menu } from '@/ui/primitives/Menu';
import { Segmented } from '@/ui/primitives/Segmented';
import { Tooltip } from '@/ui/primitives/Tooltip';
import type { SpeedMode } from '@/workers/shared/protocol';

const ICONS: Partial<Record<SpeedMode, React.ReactNode>> = { turbo: <Zap />, max: <Gauge /> };
const SPEEDS: Array<{ value: SpeedMode; name: string; title: string }> = [
  { value: '1x', name: '1x', title: 'Real time' },
  { value: '2x', name: '2x', title: 'Twice real time' },
  { value: '4x', name: '4x', title: 'Four times real time' },
  { value: 'turbo', name: 'Turbo', title: 'Trains on every core and replays recent champions' },
  { value: 'max', name: 'Max', title: 'Fastest. The viewport pauses.' },
];
const OPTIONS = SPEEDS.map((s) => ({ value: s.value, title: s.title, label: <>{ICONS[s.value]}{s.name}</> }));

/**
 * The speed selector. Watch speeds show the live generation; Turbo and Max
 * run headless. A narrow toolbar shows it as one button with a menu, since
 * the five segments alone would fill a phone's row.
 */
export function SpeedBar({ value, onChange }: { value: SpeedMode; onChange: (v: SpeedMode) => void }) {
  const current = SPEEDS.find((s) => s.value === value) ?? SPEEDS[0];
  return (
    <>
      <Tooltip content="Simulation speed" shortcut="1 to 5">
        <span className="@max-[40rem]:hidden">
          <Segmented label="Simulation speed" value={value} options={OPTIONS} onChange={onChange} />
        </span>
      </Tooltip>
      <span className="@min-[40rem]:hidden">
        <Menu
          align="start"
          trigger={
            <Button variant="outline" aria-label={`Simulation speed: ${current.name}`}>
              {ICONS[current.value]}
              {current.name}
              <ChevronUp className="text-muted" />
            </Button>
          }
          items={SPEEDS.map((s) => ({ label: s.name, icon: s.value === value ? <Check /> : <span className="size-3.5" />, onSelect: () => onChange(s.value) }))}
        />
      </span>
    </>
  );
}
