'use client';

import { Tabs as T } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/ui/cn';

/** Underlined tabs for panels. Keyboard navigation comes from Radix. */
export const Tabs = T.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn('flex h-10 shrink-0 items-stretch gap-1 border-b border-border px-2', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        'relative inline-flex items-center gap-1.5 px-2.5 text-[13px] font-medium text-muted transition-colors hover:text-fg data-[state=active]:text-fg [&_svg]:size-3.5',
        "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100 after:content-['']",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof T.Content>) {
  return <T.Content className={cn('min-h-0 flex-1 outline-none', className)} {...props} />;
}
