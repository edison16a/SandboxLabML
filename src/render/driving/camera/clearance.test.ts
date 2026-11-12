import { describe, expect, it } from 'vitest';
import { cityFor } from '@/engine/driving/city/buildCity';
import { builtInCity, DEFAULT_CITY_ID } from '@/engine/driving/city/presets';
import { CAR_DIMENSIONS, CAR_SEDAN, CAR_VAN, createWorldState, type WorldState } from '@/engine/driving/world/state';
import { CAR_ROOF } from '../traffic/shapes';
import { clearView, lensFloor, tallestNear } from './clearance';

const city = cityFor(builtInCity(DEFAULT_CITY_ID)!);

/** A world with one traffic car of `kind` at (x, y) heading along +x. */
function oneCar(kind: number, x: number, y: number): WorldState {
  const w = createWorldState(city.signals.length);
  w.carCount = 1;
  w.carX[0] = x;
  w.carY[0] = y;
  w.carHeading[0] = 0;
  w.carKind[0] = kind;
  [w.carLength[0], w.carWidth[0]] = CAR_DIMENSIONS[kind];
  return w;
}

/** A spot in the middle of a street, between two junctions: open road with nothing tall about. */
function openRoad(): { x: number; y: number } {
  const [a, b] = city.nodes;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

describe('camera clearance', () => {
  it('lifts a lens that stands over a van above its roof', () => {
    const w = oneCar(CAR_VAN, 0, 0);
    expect(lensFloor(w, 0.5, 0.3)).toBeGreaterThan(CAR_ROOF[CAR_VAN]);
    expect(lensFloor(w, 0, CAR_DIMENSIONS[CAR_VAN][1] / 2 + 0.5)).toBeGreaterThan(0);
    expect(lensFloor(w, 10, 0)).toBe(0);
    expect(lensFloor(null, 0, 0)).toBe(0);
  });

  it('turns down an orbit start with a car between the lens and the SUV', () => {
    const o = openRoad();
    expect(clearView(city, null, o.x - 7, o.y, 1.6, o.x, o.y)).toBe(true);
    expect(clearView(city, oneCar(CAR_SEDAN, o.x - 3.5, o.y), o.x - 7, o.y, 1.6, o.x, o.y)).toBe(false);
    expect(clearView(city, oneCar(CAR_SEDAN, o.x + 9, o.y), o.x - 7, o.y, 1.6, o.x, o.y)).toBe(true);
  });

  it('knows how tall the buildings round a spot are', () => {
    const o = openRoad();
    expect(tallestNear(city, o.x, o.y, 45)).toBeGreaterThan(5);
    expect(tallestNear(city, 1e5, 1e5, 10)).toBe(0);
  });
});
