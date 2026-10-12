'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/ui/cn';
import { Spinner } from '@/ui/feedback/Spinner';

/** A scene that fails stays on its poster without a word, so the note gives up after this long, ms. */
const GIVE_UP = 20_000;

/**
 * While the live scenes load, the still poster under them is softly
 * blurred and a small note says the real thing is on its way, so nobody
 * takes the still for the finished page. Both melt away once the scenes
 * are on screen. Devices that only ever get the poster never see this.
 */
export function HeroLoading({ loading: asked }: { loading: boolean }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setExpired(true), GIVE_UP);
    return () => clearTimeout(id);
  }, []);
  const loading = asked && !expired;
  return (
    <>
      <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 bg-bg/10 backdrop-blur-[3px] transition-opacity duration-700', loading ? 'animate-fade-in opacity-100' : 'opacity-0')} />
      <div
        role="status"
        className={cn(
          'pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3.5 py-1.5 text-[12px] text-white/85 backdrop-blur-sm transition-opacity duration-500',
          loading ? 'opacity-100' : 'opacity-0',
        )}
      >
        {loading && (
          <>
            <Spinner className="size-3.5" />
            Loading the live scenes
          </>
        )}
      </div>
    </>
  );
}
