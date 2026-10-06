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
      {/* Pages may not grow wider than the screen to fit their content; wide rows scroll inside instead. */}
      <main className="flex min-h-0 flex-1 [&>*]:min-w-0">{children}</main>
    </div>
  );
}
