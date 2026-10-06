'use client';

import { DropdownMenu as M } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

/** A dropdown of actions, such as the per-run menu on the Runs page. */
export function Menu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: MenuItem[]; align?: 'start' | 'end' }) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content
          align={align}
          sideOffset={4}
          className="z-50 min-w-48 animate-fade-in rounded-md border border-border-strong bg-surface-2 p-1 shadow-xl shadow-black/40"
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.separatorBefore && <M.Separator className="my-1 h-px bg-border" />}
              <M.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-3 [&_svg]:size-3.5',
                  item.danger ? 'text-danger' : 'text-fg',
                )}
              >
                {item.icon}
                {item.label}
              </M.Item>
            </div>
          ))}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
