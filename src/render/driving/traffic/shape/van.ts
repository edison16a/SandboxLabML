import { CAR_DIMENSIONS, CAR_VAN } from '@/engine/driving/world/state';
import { LAMP } from '../looks';
import { pillar, shutLine, sideGlass, strip, uprightGlass } from './outlines';
import type { CarShape, Decal } from './types';

const [length, width] = CAR_DIMENSIONS[CAR_VAN];

/**
 * The van: a modern people carrier. A short sloping nose rounds up into a
 * big raked windshield; behind it a tall flat sided box with soft roof
 * edges and rounded vertical corners at the back. x runs from the tail
 * (-2.6) to the nose (+2.6).
 */
const BASE: CarShape = {
  kind: CAR_VAN,
  length,
  width,
  wheelbase: 3.25,
  wheelRadius: 0.345,
  axleShift: 0.12,
  track: width / 2 - 0.14,
  nose: { reach: 0.72, square: 2.4, lean: 0.05, leanAt: 0.62 },
  tail: { reach: 0.3, square: 4.5, lean: 0.015, leanAt: 1.1 },
  sill: [[-2.6, 0.42], [-2.35, 0.36], [-2.0, 0.31], [1.5, 0.31], [2.2, 0.34], [2.6, 0.38]],
  trim: [[-2.6, 0.6], [-2.35, 0.56], [-2.05, 0.43], [1.5, 0.43], [2.15, 0.5], [2.6, 0.55]],
  waist: [[-2.6, 0.8], [2.6, 0.75]],
  shoulder: [[-2.6, 1.06], [1.5, 1.04], [2.1, 0.98], [2.6, 0.86]],
  belt: [[-2.6, 1.13], [1.4, 1.12], [1.9, 1.08], [2.3, 0.98], [2.6, 0.9]],
  top: [[-2.6, 1.84], [-2.52, 1.92], [-2.35, 1.955], [-1.0, 1.965], [0.7, 1.965], [1.05, 1.93], [1.3, 1.8], [1.65, 1.46], [1.95, 1.21], [2.2, 1.12], [2.42, 1.05], [2.54, 0.98], [2.6, 0.93]],
  crown: [[-2.6, 0], [-2.4, 0.02], [-2.0, 0.03], [1.0, 0.03], [1.6, 0.035], [2.0, 0.02], [2.6, 0]],
  corner: [[-2.6, 0.04], [-2.4, 0.1], [-2.0, 0.13], [0.9, 0.13], [1.4, 0.08], [1.9, 0.03], [2.6, 0.02]],
  beltIn: [[-2.6, 0.035], [2.6, 0.04]],
  sideIn: [[-2.6, 0.08], [-2.3, 0.09], [0.9, 0.09], [1.5, 0.1], [2.6, 0.1]],
  topIn: [[-2.6, 0.17], [-2.3, 0.2], [0.9, 0.21], [1.5, 0.2], [2.6, 0.18]],
  decals: [],
  mirror: { x: 1.78, y: 1.2, out: 0.19 },
  roofSign: false,
};

function vanDecals(s: CarShape): Decal[] {
  // The front door glass stops in an upright edge at the mirror, where the steep A pillar meets the door.
  const side = sideGlass(s, { cTop: -2.22, rearTip: -2.22, gap: 0.016, drop: 0.03, front: 1.8 });
  // The windshield is steep, so it is drawn from the front, kept inboard of where the A pillar turns away.
  const screen = uprightGlass('front', { low: 1.21, high: 1.885, lowHalf: 0.75, highHalf: 0.71, bow: 0.07 });
  const back = strip('rear', [[0, 1.3], [0.74, 1.3]], [[0, 1.78], [0.7, 1.78]]);
  return [
    { region: side, look: 'trim', kind: 'ring', grow: 0.022, cells: [8, 2], fine: true },
    { region: side, look: 'glass', cells: [8, 2] },
    { region: pillar(s, 0.93, 0.1, 0.02), look: 'trim', kind: 'float', cells: [1, 3], fine: true },
    { region: pillar(s, -0.42, 0.13, 0), look: 'trim', kind: 'float', cells: [1, 3], fine: true },
    { region: screen, look: 'trim', kind: 'ring', grow: 0.022, cells: [6, 4], fine: true },
    { region: screen, look: 'glass', cells: [6, 4] },
    { region: back, look: 'trim', kind: 'ring', grow: 0.025, cells: [3, 4], fine: true },
    { region: back, look: 'glass', cells: [3, 4] },
    { region: strip('rear', [[0, 1.82], [0.2, 1.82]], 0.02), look: 'tail', kind: 'float', lamp: LAMP.brake, cells: [2, 1], fine: true },
    // Head lamps sit where the nose rolls up into the hood, wrapping round each corner.
    { region: strip('front', [[0.46, 0.85], [0.66, 0.85], [0.82, 0.87], [0.92, 0.9]], [[0.44, 0.95], [0.66, 0.97], [0.82, 0.975], [0.9, 0.965]]), look: 'head', cells: [5, 1] },
    { region: strip('front', [[0.48, 0.928], [0.66, 0.945], [0.82, 0.948], [0.89, 0.94]], 0.011), look: 'drl', kind: 'float', lamp: LAMP.head, cells: [7, 1] },
    { region: strip('front', [[0.5, 0.865], [0.7, 0.868]], 0.04), look: 'lens', kind: 'float', cells: [3, 1], fine: true },
    { region: strip('front', [[0.8, 0.88], [0.91, 0.905]], 0.022), look: 'amber', kind: 'float', lamp: LAMP.right, cells: [3, 1] },
    { region: strip('front', [[0, 0.8], [0.43, 0.81]], [[0, 0.93], [0.42, 0.935]]), look: 'grille', cells: [3, 1] },
    { region: strip('front', [[0, 0.6], [0.5, 0.6], [0.62, 0.62]], [[0, 0.72], [0.52, 0.72], [0.6, 0.7]]), look: 'grille', kind: 'float', cells: [4, 1] },
    // Tall tail lamps up the rear corners.
    { region: strip('rear', [[0.8, 0.8], [0.9, 0.81], [0.955, 0.83]], [[0.8, 1.34], [0.9, 1.34], [0.945, 1.32]]), look: 'tail', lamp: LAMP.tail, cells: [2, 4] },
    { region: strip('rear', [[0.81, 0.83], [0.95, 0.84]], 0.06), look: 'amber', kind: 'float', lamp: LAMP.right, cells: [2, 1] },
    { region: strip('rear', [[0, 0.66], [0.26, 0.66]], 0.11), look: 'plate', kind: 'float', cells: [4, 1] },
    // The sliding door: its front and rear edges and the rail it runs on under the rear glass.
    { region: shutLine(0.9, 0.46, 0.92, 1.1), look: 'seam', kind: 'float', cells: [5, 1], fine: true },
    { region: shutLine(-0.36, 0.46, -0.36, 1.1), look: 'seam', kind: 'float', cells: [5, 1], fine: true },
    { region: strip('side', [[-2.2, 1.075], [-0.36, 1.075]], 0.02), look: 'trim', kind: 'float', cells: [3, 1], fine: true },
  ];
}

export const VAN: CarShape = { ...BASE, decals: vanDecals(BASE) };
