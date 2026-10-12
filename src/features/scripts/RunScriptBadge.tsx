'use client';

import { FileCode2 } from 'lucide-react';
import type { RunConfig } from '@/engine/training/runConfig';
import { cn } from '@/ui/cn';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { runScriptInfo } from './runScript';
import { BUILTIN } from './ScriptPicker';

interface Props {
  run: RunConfig | null;
  /** The generation training is on, which picks the script version in force. */
  generation: number;
  running: boolean;
}

/**
 * The script training runs on, named in the toolbar beside the generation,
 * with a live dot while it trains. A run can switch scripts part way, so
 * the name follows the generation on screen and the tooltip says when the
 * current version took over.
 */
export function RunScriptBadge({ run, generation, running }: Props) {
  if (!run) return null;
  const info = runScriptInfo(run, generation);
  const about = info.builtin ? `No script. ${BUILTIN[run.env]}` : 'Sets the rewards and how each generation breeds.';
  const edited = info.editedAt !== null ? ` In force since generation ${info.editedAt + 1}.` : '';
  return (
    <Tooltip content={`${about}${edited}`}>
      <div tabIndex={0} data-tour="script" className="hidden min-w-0 flex-col leading-tight outline-none @min-[40rem]:flex">
        <span className="flex items-center gap-1 text-[11px] text-muted">
          <FileCode2 className="size-3" />
          {running ? 'Running script' : 'Script'}
          <span aria-hidden className={cn('size-1.5 rounded-full', running ? 'animate-pulse bg-accent' : 'bg-subtle/60')} />
        </span>
        <span className={cn('max-w-48 truncate text-[13px] font-medium', info.builtin && 'text-muted')}>{info.name}</span>
      </div>
    </Tooltip>
  );
}
