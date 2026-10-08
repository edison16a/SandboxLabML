import type { Box, Size } from './geometry';

export type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Where the step card goes. A floating card sits beside the frame, in the
 * middle when nothing is framed, or over the frame when it fills the whole
 * window. On a phone the card is a sheet along the top or bottom edge.
 */
export type Placement = { kind: 'float'; x: number; y: number; side: Side | 'center' | 'over' } | { kind: 'sheet'; edge: 'top' | 'bottom' };

export interface PlaceOptions {
  /** Sides to try first, in order. The rest follow in the default order. */
  prefer?: Side[];
  /** Space between the frame and the card. */
  gap?: number;
  /** Space the card keeps from the window edges. */
  margin?: number;
}

/** Windows narrower than this get the card as a sheet instead of a floating card. */
export const SHEET_BELOW = 640;

const ORDER: Side[] = ['top', 'bottom', 'right', 'left'];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

/**
 * The card's corner on one side of the frame, centered along that side and
 * shifted back onto the screen. `fits` says whether the card clears the
 * frame there without leaving the window.
 */
export function beside(side: Side, frame: Box, card: Size, view: Size, gap: number, margin: number): { x: number; y: number; fits: boolean } {
  const vertical = side === 'top' || side === 'bottom';
  if (vertical) {
    const y = side === 'top' ? frame.y - gap - card.h : frame.y + frame.h + gap;
    const x = clamp(frame.x + frame.w / 2 - card.w / 2, margin, view.w - card.w - margin);
    const fits = y >= margin && y + card.h <= view.h - margin && card.w <= view.w - 2 * margin;
    return { x, y, fits };
  }
  const x = side === 'left' ? frame.x - gap - card.w : frame.x + frame.w + gap;
  const y = clamp(frame.y + frame.h / 2 - card.h / 2, margin, view.h - card.h - margin);
  const fits = x >= margin && x + card.w <= view.w - margin && card.h <= view.h - 2 * margin;
  return { x, y, fits };
}

/**
 * Which edge a phone sheet docks to. Bottom unless the frame would end up
 * under it, then whichever edge hides less of the frame.
 */
export function sheetEdge(frame: Box | null, sheetHeight: number, view: Size, gap = 8): 'top' | 'bottom' {
  if (!frame) return 'bottom';
  const underBottom = Math.max(0, frame.y + frame.h - (view.h - sheetHeight - gap));
  if (underBottom === 0) return 'bottom';
  const underTop = Math.max(0, sheetHeight + gap - frame.y);
  return underTop < underBottom ? 'top' : 'bottom';
}

/**
 * Places the card next to the frame without covering it. It tries the
 * preferred sides, then the rest, and takes the first where the card fits
 * whole. When no side has room, as with a frame around most of the window,
 * the card sits inside the frame near its bottom left corner.
 */
export function placeCard(frame: Box | null, card: Size, view: Size, opts: PlaceOptions = {}): Placement {
  const gap = opts.gap ?? 14;
  const margin = opts.margin ?? 16;
  if (view.w < SHEET_BELOW) return { kind: 'sheet', edge: sheetEdge(frame, card.h, view) };
  if (!frame) return { kind: 'float', side: 'center', x: (view.w - card.w) / 2, y: Math.max(margin, (view.h - card.h) / 2 - view.h * 0.04) };
  const order = [...(opts.prefer ?? []), ...ORDER.filter((s) => !opts.prefer?.includes(s))];
  for (const side of order) {
    const spot = beside(side, frame, card, view, gap, margin);
    if (spot.fits) return { kind: 'float', side, x: spot.x, y: spot.y };
  }
  return {
    kind: 'float',
    side: 'over',
    x: clamp(frame.x + margin, margin, view.w - card.w - margin),
    y: clamp(frame.y + frame.h - card.h - margin, margin, view.h - card.h - margin),
  };
}
