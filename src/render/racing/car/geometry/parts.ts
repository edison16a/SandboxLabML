import type * as THREE from 'three';
import { merge } from './grid';

/**
 * Material slots. Every piece of the car belongs to one, so the hero car
 * draws one mesh per slot and the instanced car bakes each slot into vertex
 * colors and surface values.
 */
export type Slot = 'paint' | 'carbon' | 'glass' | 'trim' | 'grille' | 'gold' | 'led' | 'tail' | 'liner' | 'metal' | 'tire' | 'rim' | 'disc' | 'caliper';

/**
 * How finely the car is built. The hero car and the instanced crowd share
 * one design and differ only in these counts, so they always read as the
 * same car.
 */
export interface Detail {
  /** Even stations along the body, plus extra ones around each arch. */
  stations: number;
  archSteps: number;
  /** Subdivisions of each of the seven section bands, sill to roof. */
  bands: number[];
  /** Subdivisions across the canopy's side glass and roof. */
  canopy: [number, number];
  /** Segments around the wheel. */
  wheel: number;
  /** Brake discs, tread grooves and chamfered spokes: wheel detail the crowd car skips. */
  brakes: boolean;
  /**
   * Detail only worth its triangles up close. It adds the mirrors, the door
   * shut line, the intake blade and bevels, uses more steps on curved parts,
   * and dices decals finely so they sit close to the paint.
   */
  fine: boolean;
}

export const DETAIL: Record<'high' | 'medium' | 'low' | 'crowd', Detail> = {
  high: { stations: 96, archSteps: 18, bands: [2, 3, 6, 5, 6, 4, 4], canopy: [6, 8], wheel: 64, brakes: true, fine: true },
  medium: { stations: 72, archSteps: 14, bands: [2, 2, 5, 4, 5, 3, 3], canopy: [5, 6], wheel: 48, brakes: true, fine: true },
  low: { stations: 48, archSteps: 10, bands: [1, 2, 4, 3, 4, 2, 2], canopy: [4, 5], wheel: 36, brakes: true, fine: false },
  crowd: { stations: 18, archSteps: 6, bands: [1, 1, 2, 2, 2, 1, 1], canopy: [2, 3], wheel: 14, brakes: false, fine: false },
};

/** Collects geometry by slot while the car is assembled. */
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
