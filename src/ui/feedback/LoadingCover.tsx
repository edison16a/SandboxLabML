'use client';

import { useEffect, useState } from 'react';
import { cn } from '../cn';
import { Spinner } from './Spinner';

interface Props {
  /** True while what sits under the cover is still loading. */
  loading: boolean;
  label: string;
  className?: string;
}

/** Longest the cover stays up, ms. If something under it failed, a stuck cover would hide the error and the controls. */
const GIVE_UP = 25_000;

/**
 * A frosted cover over a pane whose picture is not finished yet, such as a
 * 3D scene still building its hills and trees. Whatever has drawn shows
 * through blurred, so it reads as on its way rather than as the final
 * picture. It melts away once the pane is ready and never blocks clicks
 * after that.
 */
export function LoadingCover({ loading: asked, label, className }: Props) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!asked) return;
    const id = setTimeout(() => setExpired(true), GIVE_UP);
    return () => (clearTimeout(id), setExpired(false));
  }, [asked]);
  const loading = asked && !expired;
  return (
    <div
      aria-hidden={!loading}
      className={cn(
        'absolute inset-0 z-30 flex items-center justify-center bg-bg/55 backdrop-blur-md transition-opacity duration-500',
        loading ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
    >
      {loading && (
        <div role="status" className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-[13px] text-white/85 shadow-lg">
          <Spinner className="size-4" />
          {label}
        </div>
      )}
    </div>
  );
}
