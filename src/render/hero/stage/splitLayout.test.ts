import { describe, expect, it } from 'vitest';
import { splitLayout } from './splitLayout';

describe('splitLayout', () => {
  it('puts the racing scene on the left and the arena on the right of a wide hero', () => {
    const l = splitLayout(1600, 950, { x: 520, y: 260, w: 560, h: 420 });
    expect(l.stacked).toBe(false);
    expect(l.car.rect).toEqual({ x: 0, y: 0, w: 800, h: 950 });
    expect(l.arena.rect).toEqual({ x: 800, y: 0, w: 800, h: 950 });
  });

  it('centers each subject in the part of its pane the text leaves free', () => {
    const l = splitLayout(1600, 950, { x: 520, y: 260, w: 560, h: 420 });
    // 520 px are free on each side, so the subjects sit 260 px in from the outer edges.
    expect(l.car.focusX * 800).toBeCloseTo(260);
    expect((1 - l.arena.focusX) * 800).toBeCloseTo(260);
    expect(l.car.zoneW).toBeCloseTo(520 / 800);
    expect(l.arena.zoneW).toBeCloseTo(520 / 800);
  });

  it('never pushes a subject against the edge, however wide the text', () => {
    const l = splitLayout(1024, 720, { x: 100, y: 150, w: 824, h: 420 });
    expect(l.car.focusX).toBeGreaterThanOrEqual(0.26);
    expect(l.arena.focusX).toBeLessThanOrEqual(0.74);
    expect(l.car.zoneW).toBeGreaterThanOrEqual(0.52);
  });

  it('stacks the scenes on a tall hero, racing on top, with the subjects above and below the text', () => {
    const l = splitLayout(1024, 1800, { x: 200, y: 700, w: 624, h: 400 });
    expect(l.stacked).toBe(true);
    expect(l.car.rect).toEqual({ x: 0, y: 0, w: 1024, h: 900 });
    expect(l.arena.rect).toEqual({ x: 0, y: 900, w: 1024, h: 900 });
    expect(l.car.focusY * 900).toBeCloseTo(350);
    expect(900 + l.arena.focusY * 900).toBeCloseTo(1100 + 350);
    expect(l.car.focusX).toBe(0.5);
  });

  it('centers the subjects before the text has been measured', () => {
    const l = splitLayout(1600, 950, null);
    expect(l.car.focusX).toBeCloseTo(0.5);
    expect(l.arena.focusX).toBeCloseTo(0.5);
    expect(l.car.zoneW).toBe(1);
  });
});
