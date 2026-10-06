'use client';

import type { ReactNode } from 'react';
import { TooltipProvider } from '@/ui/primitives/Tooltip';
import { Toaster } from '@/ui/toast/Toaster';

/** Client-side context shared by all routes. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={150}>
      {children}
      <Toaster />
    </TooltipProvider>
  );
}
