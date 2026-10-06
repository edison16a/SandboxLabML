import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';

/**
 * Full-viewport layout for tool pages. The header is fixed height and the
 * body fills the rest without page scroll, so viewports and panels can size
 * themselves with flexbox.
 */
export function Workspace({ children, headerRight }: { children: ReactNode; headerRight?: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader right={headerRight} />
      <main className="flex min-h-0 flex-1">{children}</main>
    </div>
  );
}
