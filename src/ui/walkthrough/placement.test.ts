import { describe, expect, it } from 'vitest';
import type { Box } from './geometry';
import { beside, placeCard, sheetEdge, SHEET_BELOW } from './placement';

const view = { w: 1600, h: 1000 };
const card = { w: 360, h: 220 };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('placeCard', () => {
  it('centers the card when nothing is framed', () => {
    const p = placeCard(null, card, view);
    expect(p).toMatchObject({ kind: 'float', side: 'center' });
    if (p.kind === 'float') expect(p.x).toBe((view.w - card.w) / 2);
  });

  it('puts the card above a toolbar button and shifts it back on screen', () => {
    const train: Box = { x: 6, y: 946, w: 124, h: 52 };
    const p = placeCard(train, card, view, { prefer: ['top'] });
    expect(p).toMatchObject({ kind: 'float', side: 'top', x: 16 });
    if (p.kind === 'float') {
      expect(p.y + card.h).toBeLessThanOrEqual(train.y);
      expect(overlaps({ ...p, ...card }, train)).toBe(false);
    }
  });

  it('flips to the other side when the preferred one has no room', () => {
    const nav: Box = { x: 390, y: 4, w: 80, h: 40 };
    expect(placeCard(nav, card, view, { prefer: ['top'] })).toMatchObject({ side: 'bottom' });
    const panel: Box = { x: 1196, y: 46, w: 402, h: 900 };
    expect(placeCard(panel, card, view, { prefer: ['right'] })).toMatchObject({ side: 'left' });
  });

  it('never covers the frame while some side has room', () => {
    const frames: Box[] = [
      { x: 0, y: 46, w: 1200, h: 900 },
      { x: 700, y: 60, w: 300, h: 32 },
      { x: 1500, y: 500, w: 90, h: 40 },
    ];
    for (const f of frames) {
      const p = placeCard(f, card, view);
      expect(p.kind).toBe('float');
      if (p.kind === 'float') {
        expect(p.side).not.toBe('over');
        expect(overlaps({ ...p, ...card }, f)).toBe(false);
        expect(p.x).toBeGreaterThanOrEqual(16);
        expect(p.x + card.w).toBeLessThanOrEqual(view.w - 16);
      }
    }
  });

  it('sits inside a frame that fills the window', () => {
    const p = placeCard({ x: 2, y: 2, w: 1596, h: 996 }, card, view);
    expect(p).toMatchObject({ kind: 'float', side: 'over' });
    if (p.kind === 'float') expect(p.y + card.h).toBeLessThanOrEqual(view.h - 16);
  });

  it('turns into a sheet on a phone', () => {
    const phone = { w: 390, h: 844 };
    expect(SHEET_BELOW).toBeGreaterThan(phone.w);
    expect(placeCard({ x: 10, y: 60, w: 100, h: 30 }, card, phone)).toEqual({ kind: 'sheet', edge: 'bottom' });
    expect(placeCard({ x: 0, y: 560, w: 390, h: 280 }, card, phone)).toEqual({ kind: 'sheet', edge: 'top' });
  });
});

describe('beside', () => {
  it('centers along the side it sits on', () => {
    const frame: Box = { x: 600, y: 400, w: 200, h: 100 };
    const right = beside('right', frame, card, view, 10, 16);
    expect(right.x).toBe(810);
    expect(right.y + card.h / 2).toBe(450);
    expect(right.fits).toBe(true);
  });
});

describe('sheetEdge', () => {
  const phone = { w: 390, h: 844 };
  it('stays at the bottom when the frame is clear of it', () => {
    expect(sheetEdge(null, 260, phone)).toBe('bottom');
    expect(sheetEdge({ x: 0, y: 100, w: 390, h: 300 }, 260, phone)).toBe('bottom');
  });
  it('moves to the top when the frame would sit under it', () => {
    expect(sheetEdge({ x: 0, y: 500, w: 390, h: 60 }, 300, phone)).toBe('top');
  });
  it('picks the edge that hides less of a tall frame', () => {
    expect(sheetEdge({ x: 0, y: 48, w: 390, h: 500 }, 300, phone)).toBe('bottom');
  });
});
