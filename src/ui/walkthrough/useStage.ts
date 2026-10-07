'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { cutoutPath, frameAround, restingHole, unionBox, type Box } from './geometry';
import { placeCard } from './placement';
import { createSpring, glide, snapSpring, type Spring } from './spring';
import type { StepText } from './types';

export interface StageRefs {
  dim: RefObject<SVGPathElement | null>;
  ring: RefObject<SVGRectElement | null>;
  card: RefObject<HTMLDivElement | null>;
}

export interface StageScene {
  /** What the open step frames and where its card prefers to go. Null on the welcome card. */
  text: StepText | null;
  reduced: boolean;
  /** Changes whenever the step or its text changes. */
  key: string;
}

/** Room between the target and the frame, and the frame's corner radius. */
const PAD = 6;
const RADIUS = 10;
/** The outline sits just outside the hole so it never covers the target. */
const RING_GAP = 1.5;

/** Every visible match of a selector, merged into one box in window pixels. */
export function measureTarget(selector: string): Box | null {
  const boxes: Box[] = [];
  document.querySelectorAll(selector).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) boxes.push({ x: r.left, y: r.top, w: r.width, h: r.height });
  });
  return unionBox(boxes);
}

function frameOf(text: StepText | null, view: { w: number; h: number }): Box | null {
  if (!text?.target) return null;
  const raw = measureTarget(text.target) ?? (text.fallback ? measureTarget(text.fallback) : null);
  return raw ? frameAround(raw, PAD, view) : null;
}

const asArray = (b: Box) => [b.x, b.y, b.w, b.h];

/**
 * Runs the spotlight. Every frame it measures the target, so the frame
 * follows it when it moves or resizes, then springs the hole, the outline
 * and the card toward where they belong and writes them straight to the
 * DOM. React only renders when the step changes. With reduced motion the
 * springs snap and the outline fades in at its new place instead.
 */
export function useStage(refs: StageRefs, scene: StageScene): void {
  const latest = useRef(scene);
  useLayoutEffect(() => {
    latest.current = scene;
  });
  const { dim: dimRef, ring: ringRef, card: cardRef } = refs;

  useLayoutEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hole: Spring | null = null;
    let card: Spring | null = null;
    let lastPath = '';
    let lastKey = '';

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { text, reduced, key } = latest.current;
      const view = { w: window.innerWidth, h: window.innerHeight };
      const frame = frameOf(text, view);
      const goal = asArray(frame ?? restingHole(view));
      hole ??= createSpring(asArray(restingHole(view)));
      if (reduced) snapSpring(hole, goal);
      else glide(hole, goal, dt);
      const [x, y, w, h] = hole.value;

      const path = cutoutPath(view, { x, y, w, h }, RADIUS);
      if (path !== lastPath) {
        dimRef.current?.setAttribute('d', path);
        lastPath = path;
      }
      const ring = ringRef.current;
      if (ring) {
        ring.setAttribute('x', `${x - RING_GAP}`);
        ring.setAttribute('y', `${y - RING_GAP}`);
        ring.setAttribute('width', `${Math.max(0, w + RING_GAP * 2)}`);
        ring.setAttribute('height', `${Math.max(0, h + RING_GAP * 2)}`);
        ring.style.opacity = frame ? '1' : '0';
        if (key !== lastKey && reduced && frame) ring.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      }

      const el = cardRef.current;
      if (el) {
        const place = placeCard(frame, { w: el.offsetWidth, h: el.offsetHeight }, view, { prefer: text?.prefer });
        el.dataset.place = place.kind;
        if (place.kind === 'sheet') {
          el.dataset.edge = place.edge;
          el.style.transform = '';
          card = null;
        } else {
          // Whole pixels at rest keep the text crisp.
          const spot = [Math.round(place.x), Math.round(place.y)];
          if (!card || reduced) card = createSpring(spot);
          else glide(card, spot, dt);
          el.style.transform = `translate3d(${card.value[0].toFixed(2)}px, ${card.value[1].toFixed(2)}px, 0)`;
        }
      }
      lastKey = key;
      raf = requestAnimationFrame(tick);
    };

    // One frame now, before the first paint, so the card never shows in the wrong place.
    tick(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [dimRef, ringRef, cardRef]);
}
