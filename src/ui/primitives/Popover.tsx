'use client';

import { Popover as P } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Names the panel for screen readers, which announce it as a dialog. */
  label?: string;
  /** Runs as the closed panel hands focus back to its trigger. Prevent the event to send focus elsewhere. */
  onCloseAutoFocus?: (event: Event) => void;
}

/** Anchored floating panel, used for settings menus and the block editor. */
export function Popover({ trigger, children, side = 'bottom', align = 'start', className, open, onOpenChange, label, onCloseAutoFocus }: PopoverProps) {
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          side={side}
          align={align}
          sideOffset={6}
          aria-label={label}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            'z-50 w-72 animate-fade-in rounded-lg border border-border-strong bg-surface-2 p-3 shadow-xl shadow-black/40 outline-none',
            className,
          )}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
