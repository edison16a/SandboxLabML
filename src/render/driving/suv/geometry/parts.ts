import type * as THREE from 'three';
import { merge } from './grid';

/**
 * Material slots. Every piece of the SUV belongs to one, so the followed
 * SUV draws one mesh per slot and the population SUV bakes each slot into
 * vertex colors and surface values.
 */
export type Slot = 'paint' | 'glass' | 'trim' | 'clad' | 'grille' | 'led' | 'tail' | 'liner' | 'metal' | 'tire' | 'rim' | 'face' | 'disc' | 'caliper';

export const SLOTS: readonly Slot[] = ['paint', 'glass', 'trim', 'clad', 'grille', 'led', 'tail', 'liner', 'metal', 'tire', 'rim', 'face', 'disc', 'caliper'];

/**
 * How finely the SUV is built. The followed SUV and the population share
 * one design and differ only in these counts, so they always read as the
 * same car.
 */
export interface Detail {
  /** Even stations along the body, plus extra ones round each arch. */
  stations: number;
  archSteps: number;
  /** Subdivisions of each of the seven body bands, sill to centerline. */
  bands: number[];
  /** Subdivisions across the cabin's side glass and roof. */
  cabin: [number, number];
  /** Segments round the wheel. */
  wheel: number;
  /** Brake discs, calipers and tread grooves. */
  brakes: boolean;
  /** Mirrors, handles, shut lines and bevels: detail only worth its triangles up close. */
  fine: boolean;
}

export const DETAIL: Record<'high' | 'medium' | 'low' | 'crowd' | 'crowdLow', Detail> = {
  high: { stations: 104, archSteps: 22, bands: [3, 4, 6, 3, 4, 6, 4], cabin: [6, 9], wheel: 50, brakes: true, fine: true },
  medium: { stations: 76, archSteps: 16, bands: [3, 4, 5, 2, 4, 5, 3], cabin: [5, 7], wheel: 48, brakes: true, fine: true },
  low: { stations: 50, archSteps: 11, bands: [2, 3, 4, 2, 3, 3, 2], cabin: [4, 5], wheel: 36, brakes: true, fine: false },
  crowd: { stations: 24, archSteps: 9, bands: [1, 1, 2, 1, 2, 2, 1], cabin: [2, 3], wheel: 14, brakes: false, fine: false },
  crowdLow: { stations: 14, archSteps: 6, bands: [1, 1, 1, 1, 1, 1, 1], cabin: [1, 2], wheel: 9, brakes: false, fine: false },
};

/**
 * How a panel gap is drawn, m: a dark line 9 mm wide, standing just off
 * the paint. A real gap is narrower, but its shadow reads about this wide,
 * and at the orbit camera's distance a thinner line falls under a pixel
 * and breaks into dots.
 */
export const SHUT = { width: 0.009, lift: 0.0015 };

/** The far population's lightest build, which drops even the small trims a 100 car field cannot afford. */
export const lightest = (detail: Detail) => detail.wheel < 12;

/** Collects geometry by slot while the SUV is assembled. */
export class PartBin {
  private bins = new Map<Slot, THREE.BufferGeometry[]>();

  add(slot: Slot, ...geometry: THREE.BufferGeometry[]): void {
    const list = this.bins.get(slot) ?? [];
    list.push(...geometry);
    this.bins.set(slot, list);
  }

  /** One merged geometry per slot that has anything in it. */
  build(): Map<Slot, THREE.BufferGeometry> {
    const out = new Map<Slot, THREE.BufferGeometry>();
    for (const [slot, list] of this.bins) {
      const g = merge(list);
      g.computeBoundingSphere();
      out.set(slot, g);
      list.forEach((p) => p !== g && p.dispose());
    }
    return out;
  }
}
