import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GHOST, PackView, settle, type PackFocus } from './packView';

/** A wide view far from every car, with nothing followed. */
function farView(): PackFocus {
  return { hidden: -1, clearFocus: false, ghostRest: false, hasFocus: false, cam: new THREE.Vector3(400, 60, 400), focus: new THREE.Vector3(1000, 0, 0), yaw: 0 };
}

/** Packs (x, y, heading) triples into a pose array. */
function poses(...cars: Array<[number, number, number]>): Float32Array {
  return Float32Array.from(cars.flat());
}

describe('choosing which cars of the pack to draw', () => {
  it('keeps a car on whichever side of the band it already is', () => {
    expect(settle(0.5, 1)).toBe(1);
    expect(settle(0.2, 1)).toBe(0);
    expect(settle(0.5, 0)).toBe(0);
    expect(settle(0.8, 0)).toBe(1);
  });

  it('turns a car whose body cuts into a solid one into a ghost, and keeps one in the next lane or a length ahead solid', () => {
    const pack = new PackView(8);
    pack.decide(4, poses([0, 0, 0], [2, 0.5, 0], [0, 3, 0], [5.5, 0, 0]), new Uint8Array(4), farView());
    expect(Array.from(pack.target.slice(0, 4))).toEqual([1, GHOST, 1, 1].map(Math.fround));
  });

  it('measures the overlap in the kept car own frame, so a car side by side across a bend still counts', () => {
    const pack = new PackView(4);
    // Facing +y, a car 3 m ahead along y overlaps; one 3 m to the side along x does not.
    pack.decide(3, poses([0, 0, Math.PI / 2], [0, 3, Math.PI / 2], [3, 0, Math.PI / 2]), new Uint8Array(3), farView());
    expect(Array.from(pack.target.slice(0, 3))).toEqual([1, GHOST, 1].map(Math.fround));
  });

  it('keeps a running car solid and turns a wreck on its line into a ghost', () => {
    const pack = new PackView(4);
    pack.decide(2, poses([0, 0, 0], [1, 0, 0]), Uint8Array.from([1, 0]), farView());
    expect(Array.from(pack.target.slice(0, 2))).toEqual([GHOST, 1].map(Math.fround));
  });

  it('draws every car but the followed one as a ghost in the chase view, overlapping or not', () => {
    const pack = new PackView(4);
    const view = farView();
    view.ghostRest = true;
    view.hidden = 0;
    pack.decide(3, poses([0, 0, 0], [40, 0, 0], [41, 0.5, 0]), new Uint8Array(3), view);
    expect(Array.from(pack.target.slice(0, 3))).toEqual([0, GHOST, GHOST].map(Math.fround));
  });

  it('hides a car at the lens and brings it back only once it is clearly away', () => {
    const pack = new PackView(2);
    const view = farView();
    view.cam.set(0, 2, 0);
    const still = new Uint8Array(1);
    // At 7 m a shown car stays and a hidden one stays hidden; under 6.5 m it goes, past 7.5 m it returns.
    pack.decide(1, poses([7, 0, 0]), still, view);
    expect(pack.target[0]).toBe(1);
    pack.decide(1, poses([6.2, 0, 0]), still, view);
    expect(pack.target[0]).toBe(0);
    pack.decide(1, poses([7, 0, 0]), still, view);
    expect(pack.target[0]).toBe(0);
    pack.decide(1, poses([7.8, 0, 0]), still, view);
    expect(pack.target[0]).toBe(1);
  });

  it('never draws the car the detailed model replaces', () => {
    const pack = new PackView(2);
    const view = farView();
    view.hidden = 0;
    pack.decide(2, poses([0, 0, 0], [1, 0, 0]), new Uint8Array(2), view);
    // The hidden car is never kept, so it pushes no copy out; overlapping the followed car is its own rule.
    expect(pack.target[0]).toBe(0);
    expect(pack.target[1]).toBe(1);
  });
});
