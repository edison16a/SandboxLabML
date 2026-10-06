'use client';

import { Dices, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import type { SandboxControl } from '../../session/sandboxControl';
import type { ArenaPulse } from '../../hooks/useArenaPulse';

const glass = 'border-white/10 bg-white/10 text-white hover:bg-white/20';

/**
 * Run, Pause and Restart for the Sandbox match, plus new spawn spots. Once
 * a match has played out, Run plays it again from the start.
 */
export function SandboxRunBar({ control, playing, pulse }: { control: SandboxControl | null; playing: boolean; pulse: ArenaPulse }) {
  const running = playing && !pulse.over;
  return (
    <div className="flex items-center gap-1.5">
      <Tooltip content={running ? 'Pause the match' : pulse.over ? 'Play the match again' : 'Run the match'} shortcut="Space">
        <Button variant="primary" size="sm" className="w-[104px] justify-center" onClick={() => void control?.toggle()}>
          {running ? <Pause /> : <Play />}
          {running ? 'Pause' : pulse.over ? 'Run again' : 'Run'}
        </Button>
      </Tooltip>
      <Tooltip content="Restart from the same spawn spots" shortcut="R">
        <Button size="sm" variant="secondary" className={glass} onClick={() => void control?.restart()}>
          <RotateCcw />
          Restart
        </Button>
      </Tooltip>
      <span className="flex-1" />
      <Tooltip content="New spawn spots">
        <Button
          size="icon-sm"
          variant="secondary"
          className={glass}
          onClick={() => void control?.configure({ seed: Math.floor(Math.random() * 1e6) })}
          aria-label="New spawn spots"
        >
          <Dices />
        </Button>
      </Tooltip>
    </div>
  );
}
