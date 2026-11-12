import { describe, expect, it } from 'vitest';
import { splitLayout } from './splitLayout';

describe('splitLayout', () => {
  it('puts the city on the left and the course on the right of a wide hero', () => {
    const l = splitLayout(1600, 950, { x: 520, y: 260, w: 560, h: 420 });
    expect(l.stacked).toBe(false);
    expect(l.drive.rect).toEqual({ x: 0, y: 0, w: 800, h: 950 });
    expect(l.run.rect).toEqual({ x: 800, y: 0, w: 800, h: 950 });
  });

  it('centers each subject in the part of its pane the text leaves free', () => {
    const l = splitLayout(1600, 950, { x: 520, y: 260, w: 560, h: 420 });
    // 520 px are free on each side, so the subjects sit 260 px in from the outer edges.
    expect(l.drive.focusX * 800).toBeCloseTo(260);
    expect((1 - l.run.focusX) * 800).toBeCloseTo(260);
    expect(l.drive.zoneW).toBeCloseTo(520 / 800);
    expect(l.run.zoneW).toBeCloseTo(520 / 800);
  });

  it('never pushes a subject against the edge, however wide the text', () => {
    const l = splitLayout(1024, 720, { x: 100, y: 150, w: 824, h: 420 });
    expect(l.drive.focusX).toBeGreaterThanOrEqual(0.26);
    expect(l.run.focusX).toBeLessThanOrEqual(0.74);
    expect(l.drive.zoneW).toBeGreaterThanOrEqual(0.52);
  });

  it('stacks the scenes on a tall hero, the city on top, with the subjects above and below the text', () => {
    const l = splitLayout(1024, 1800, { x: 200, y: 700, w: 624, h: 400 });
    expect(l.stacked).toBe(true);
    expect(l.drive.rect).toEqual({ x: 0, y: 0, w: 1024, h: 900 });
    expect(l.run.rect).toEqual({ x: 0, y: 900, w: 1024, h: 900 });
    expect(l.drive.focusY * 900).toBeCloseTo(350);
    expect(900 + l.run.focusY * 900).toBeCloseTo(1100 + 350);
    expect(l.drive.focusX).toBe(0.5);
  });

  it('centers the subjects before the text has been measured', () => {
    const l = splitLayout(1600, 950, null);
    expect(l.drive.focusX).toBeCloseTo(0.5);
    expect(l.run.focusX).toBeCloseTo(0.5);
    expect(l.drive.zoneW).toBe(1);
  });
});
