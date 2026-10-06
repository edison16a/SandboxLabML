'use client';

import { Tooltip as T } from 'radix-ui';
import type { ReactNode } from 'react';
import { Kbd } from './Kbd';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Keyboard shortcut shown after the label, e.g. "I". */
  shortcut?: string;
}

/** Small dark tooltip. Wrap the app in TooltipProvider once (see Providers). */
export function Tooltip({ content, children, side = 'top', shortcut }: TooltipProps) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 flex max-w-72 animate-fade-in items-center gap-2 rounded-md border border-border-strong bg-surface-3 px-2 py-1 text-[12px] leading-snug text-fg shadow-lg shadow-black/40"
        >
          <span>{content}</span>
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export const TooltipProvider = T.Provider;
