import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fitsFrame, heroLayout } from './framedLayout';
import { applyLensShift } from './paneView';
import { coverFrame, POSTER_FRAMES } from './posterFrame';
import { splitLayout, type Pane } from './splitLayout';

const { wide, standard, portrait } = POSTER_FRAMES;

/** Where the camera's aim lands on the pane's canvas, CSS px from its top left. */
function aimOnCanvas(pane: Pane): { x: number; y: number } {
  const camera = new THREE.PerspectiveCamera(46, pane.rect.w / pane.rect.h, 0.1, 100);
  camera.updateMatrixWorld();
  applyLensShift(camera, pane);
  const p = new THREE.Vector3(0, 0, -10).project(camera);
  return { x: ((p.x + 1) / 2) * pane.rect.w, y: ((1 - p.y) / 2) * pane.rect.h };
}

describe('heroLayout', () => {
  it('is the poster frame itself at the size the poster was shot', () => {
    const l = heroLayout(wide.width, wide.height, wide, null);
    const plain = splitLayout(wide.width, wide.height, wide.panel);
    expect(l.drive.rect).toEqual(plain.drive.rect);
    expect(l.drive.view).toEqual({ x: 0, y: 0, w: plain.drive.rect.w, h: plain.drive.rect.h });
    expect(l.run.focusX).toBeCloseTo(plain.run.focusX);
  });

  it('crops and scales the frame on a smaller window the way the poster image is', () => {
    const l = heroLayout(1600, 952, wide, { x: 496, y: 270, w: 608, h: 413 });
    const cover = coverFrame(wide, 1600, 952);
    expect(l.drive.rect).toEqual({ x: 0, y: 0, w: 800, h: 952 });
    expect(l.run.rect).toEqual({ x: 800, y: 0, w: 800, h: 952 });
    for (const pane of [l.drive, l.run]) {
      // The shot keeps its poster size; the canvas shows the part of it the window keeps, at the cover's scale.
      expect(pane.shot).toEqual({ w: 960, h: 1080 });
      expect(pane.view.w * cover.scale).toBeCloseTo(pane.rect.w);
      expect(pane.rect.x - pane.view.x * cover.scale).toBeCloseTo(cover.x + (pane === l.drive ? 0 : 960 * cover.scale));
    }
  });

  it('lands the camera aim where the poster has the subject', () => {
    const l = heroLayout(1600, 952, wide, null);
    const cover = coverFrame(wide, 1600, 952);
    for (const pane of [l.drive, l.run]) {
      const aim = aimOnCanvas(pane);
      const left = pane === l.drive ? 0 : 960;
      expect(pane.rect.x + aim.x).toBeCloseTo(cover.x + (left + pane.focusX * 960) * cover.scale, 3);
      expect(aim.y).toBeCloseTo(cover.y + pane.focusY * 1080 * cover.scale, 3);
    }
  });

  it('frames the hero around the measured panel when the window is far from the frame shape', () => {
    const panel = { x: 360, y: 340, w: 480, h: 420 };
    expect(heroLayout(1200, 1102, standard, panel)).toEqual(splitLayout(1200, 1102, panel));
    expect(heroLayout(1600, 952, null, panel)).toEqual(splitLayout(1600, 952, panel));
  });
});

describe('fitsFrame', () => {
  it('takes common window shapes', () => {
    expect(fitsFrame(wide, 1600, 952)).toBe(true);
    expect(fitsFrame(wide, 1920, 912)).toBe(true);
    expect(fitsFrame(wide, 1366, 610)).toBe(true);
    expect(fitsFrame(wide, 3440, 1392)).toBe(true);
    expect(fitsFrame(standard, 1024, 720)).toBe(true);
    expect(fitsFrame(standard, 1280, 976)).toBe(true);
    expect(fitsFrame(portrait, 1080, 1752)).toBe(true);
  });

  it('turns away a crop that would cut a subject off', () => {
    // Nearly square: the 4:3 frame would lose the SUV at its left edge.
    expect(fitsFrame(standard, 1200, 1102)).toBe(false);
    // A large portrait tablet: the tall frame would lose the SUV at its top.
    expect(fitsFrame(portrait, 1024, 1318)).toBe(false);
    expect(fitsFrame(wide, 5120, 1392)).toBe(false);
  });
});
