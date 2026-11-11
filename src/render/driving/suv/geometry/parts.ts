import type * as THREE from 'three';
import { merge } from './grid';

/**
 * Material slots. Every piece of the SUV belongs to one, so the followed
 * SUV draws one mesh per slot and the population SUV bakes each slot into
 * vertex colors and surface values.
 */
export type Slot = 'paint' | 'glass' | 'trim' | 'clad' | 'grille' | 'led' | 'tail' | 'liner' | 'metal' | 'tire' | 'rim' | 'disc' | 'caliper';

export const SLOTS: readonly Slot[] = ['paint', 'glass', 'trim', 'clad', 'grille', 'led', 'tail', 'liner', 'metal', 'tire', 'rim', 'disc', 'caliper'];

/**
 * How finely the SUV is built. The followed SUV and the population share
 * one design and differ only in these counts, so they always read as the
 * same car.
 */
export interface Detail {
  /** Even stations along the body, plus extra ones round each arch. */
  stations: number;
  archSteps: number;
  /** Subdivisions of each of the six body bands, sill to centerline. */
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
  high: { stations: 104, archSteps: 22, bands: [2, 3, 4, 4, 5, 4], cabin: [6, 9], wheel: 64, brakes: true, fine: true },
  medium: { stations: 76, archSteps: 16, bands: [2, 2, 3, 3, 4, 3], cabin: [5, 7], wheel: 48, brakes: true, fine: true },
  low: { stations: 50, archSteps: 11, bands: [1, 2, 3, 2, 3, 2], cabin: [4, 5], wheel: 36, brakes: true, fine: false },
  crowd: { stations: 20, archSteps: 6, bands: [1, 1, 2, 1, 2, 1], cabin: [2, 3], wheel: 14, brakes: false, fine: false },
  crowdLow: { stations: 12, archSteps: 4, bands: [1, 1, 1, 1, 1, 1], cabin: [1, 2], wheel: 9, brakes: false, fine: false },
};

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
