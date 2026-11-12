'use client';

import type { ReactNode, RefObject } from 'react';
import type { Rect } from '@/render/hero/stage/splitLayout';
import { cn } from '@/ui/cn';

interface Props {
  rect: Rect;
  /** The scene has compiled: the pane fades in over its half of the poster. */
  shown: boolean;
  /** The layer the cut between episodes dips to, set by the scene every frame. */
  dip: RefObject<HTMLDivElement | null>;
  scene: 'drive' | 'run';
  children: ReactNode;
}

/**
 * One scene's place in the hero: its canvas, exactly over its half of the
 * poster, and over it a layer in the page color that the scene darkens to
 * for the calm cut between two trips or courses. The pane itself starts
 * clear and fades in once its scene is ready, so the poster under it
 * gives way without a jump.
 */
export function HeroPane({ rect, shown, dip, scene, children }: Props) {
  return (
    <div
      data-hero-pane={scene}
      className={cn('absolute overflow-hidden transition-opacity duration-[1200ms] ease-out', shown ? 'opacity-100' : 'opacity-0')}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      {children}
      <div ref={dip} className="pointer-events-none absolute inset-0 bg-bg opacity-0" />
    </div>
  );
}
