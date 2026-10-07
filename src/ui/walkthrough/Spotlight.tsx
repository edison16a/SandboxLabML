'use client';

import type { RefObject } from 'react';

interface Props {
  dimRef: RefObject<SVGPathElement | null>;
  ringRef: RefObject<SVGRectElement | null>;
  /** A press on the dimmed part, which the page underneath does not get. */
  onDimPress: () => void;
}

/**
 * The dimmed window with a rounded hole over the step's target and a thin
 * accent outline around it. The hole is unpainted, so the page shows
 * through it live and takes clicks there. useStage draws both shapes.
 */
export function Spotlight({ dimRef, ringRef, onDimPress }: Props) {
  return (
    <svg className="pointer-events-none fixed inset-0 h-full w-full animate-fade-in" aria-hidden="true">
      <path ref={dimRef} fillRule="evenodd" className="pointer-events-auto fill-[#03060c]/65" onPointerDown={onDimPress} />
      <rect ref={ringRef} rx={11.5} className="fill-none stroke-accent opacity-0 transition-opacity duration-200" strokeWidth={2} />
    </svg>
  );
}
