import { CAR_DIMENSIONS, CAR_SEDAN } from '@/engine/driving/world/state';
import { LAMP } from '../looks';
import { pillar, shutLine, sideGlass, strip, topGlass } from './outlines';
import type { CarShape, Decal } from './types';

const [length, width] = CAR_DIMENSIONS[CAR_SEDAN];

/**
 * The saloon: a modern mid size four door with a fastback roof that runs
 * down to a short deck, short overhangs, a shoulder that rises gently
 * toward the tail and a low, smooth face. Heights in meters, x from the
 * tail (-2.35) to the nose (+2.35).
 */
export const SALOON_BASE: CarShape = {
  kind: CAR_SEDAN,
  length,
  width,
  wheelbase: 2.82,
  wheelRadius: 0.345,
  axleShift: 0.02,
  track: width / 2 - 0.135,
  nose: { reach: 0.62, square: 2.8, lean: 0.05, leanAt: 0.46 },
  tail: { reach: 0.58, square: 2.7, lean: 0.06, leanAt: 0.66 },
  sill: [[-2.35, 0.37], [-2.1, 0.31], [-1.85, 0.24], [-1.3, 0.215], [1.3, 0.215], [1.9, 0.24], [2.18, 0.29], [2.35, 0.32]],
  trim: [[-2.35, 0.47], [-2.1, 0.43], [-1.85, 0.3], [-1.3, 0.265], [1.3, 0.265], [1.9, 0.3], [2.15, 0.37], [2.35, 0.39]],
  waist: [[-2.35, 0.6], [0, 0.56], [2.35, 0.54]],
  shoulder: [[-2.35, 0.85], [-1.6, 0.86], [0, 0.82], [1.5, 0.78], [2.35, 0.71]],
  belt: [[-2.35, 0.98], [-1.8, 1.01], [-1.2, 1.0], [0, 0.975], [1.0, 0.95], [1.5, 0.88], [2.0, 0.8], [2.35, 0.74]],
  top: [[-2.35, 0.99], [-2.22, 1.03], [-1.95, 1.055], [-1.62, 1.08], [-1.2, 1.2], [-0.55, 1.39], [-0.1, 1.45], [0.3, 1.43], [0.7, 1.24], [1.12, 1.0], [1.5, 0.94], [2.0, 0.86], [2.26, 0.79], [2.35, 0.75]],
  crown: [[-2.35, 0], [-1.9, 0.02], [-1.5, 0.035], [-0.6, 0.05], [0.4, 0.05], [1.0, 0.035], [1.5, 0.02], [2.35, 0]],
  corner: [[-2.35, 0.01], [-1.75, 0.02], [-1.2, 0.05], [-0.6, 0.075], [0.4, 0.075], [0.9, 0.05], [1.3, 0.02], [2.35, 0.01]],
  beltIn: [[-2.35, 0.05], [0, 0.065], [2.35, 0.05]],
  sideIn: [[-2.35, 0.1], [-1.75, 0.11], [-1.2, 0.2], [-0.6, 0.25], [0.4, 0.25], [1.0, 0.16], [1.4, 0.11], [2.35, 0.1]],
  topIn: [[-2.35, 0.17], [-1.75, 0.19], [-1.2, 0.28], [-0.6, 0.33], [0.4, 0.33], [1.0, 0.25], [1.4, 0.2], [2.35, 0.17]],
  decals: [],
  mirror: { x: 0.9, y: 1.0, out: 0.16 },
  roofSign: false,
};

/** Glass, lamps, grille and plate for a saloon shaped body; the cab shares them. */
export function saloonDecals(s: CarShape): Decal[] {
  const side = sideGlass(s, { cTop: -0.72, rearTip: -1.3 });
  const screen = topGlass(s, { low: 1.08, high: 0.36, bow: 0.1, margin: 0.03 });
  const back = topGlass(s, { low: -1.58, high: -0.6, bow: 0.12, margin: 0.035 });
  return [
    { region: side, look: 'trim', kind: 'ring', grow: 0.022, cells: [8, 2], fine: true },
    { region: side, look: 'glass', cells: [8, 2] },
    { region: pillar(s, -0.08, 0.075, 0.03), look: 'trim', kind: 'float', cells: [1, 3], fine: true },
    { region: screen, look: 'trim', kind: 'ring', grow: 0.02, cells: [3, 4], fine: true },
    { region: screen, look: 'glass', cells: [3, 4] },
    { region: back, look: 'trim', kind: 'ring', grow: 0.02, cells: [3, 4], fine: true },
    { region: back, look: 'glass', cells: [3, 4] },
    { region: strip('top', [[-0.66, 0], [-0.66, 0.26]], [[-0.62, 0], [-0.62, 0.26]]), look: 'tail', kind: 'float', lamp: LAMP.brake, cells: [2, 1], fine: true },
    // Head lamps: a slim dark housing, a lit strip along its top, a bright lens and the indicator at its outer end.
    { region: strip('front', [[0.4, 0.672], [0.6, 0.665], [0.78, 0.672], [0.88, 0.69]], [[0.38, 0.718], [0.6, 0.728], [0.78, 0.728], [0.875, 0.716]]), look: 'head', cells: [5, 1] },
    { region: strip('front', [[0.43, 0.705], [0.6, 0.713], [0.78, 0.713], [0.86, 0.705]], 0.009), look: 'drl', kind: 'float', lamp: LAMP.head, cells: [8, 1] },
    { region: strip('front', [[0.47, 0.68], [0.68, 0.677]], 0.018), look: 'lens', kind: 'float', cells: [3, 1], fine: true },
    { region: strip('front', [[0.79, 0.679], [0.865, 0.692]], 0.016), look: 'amber', kind: 'float', lamp: LAMP.left, cells: [3, 1] },
    { region: strip('front', [[0, 0.668], [0.37, 0.674]], [[0, 0.712], [0.36, 0.716]]), look: 'grille', kind: 'float', cells: [3, 1] },
    { region: strip('front', [[0, 0.4], [0.5, 0.405], [0.62, 0.43]], [[0, 0.52], [0.48, 0.52], [0.58, 0.5]]), look: 'grille', kind: 'float', cells: [4, 1] },
    // Tail lamps wrap round the corners; the indicator is their inner end.
    { region: strip('rear', [[0.4, 0.862], [0.6, 0.856], [0.82, 0.862], [0.905, 0.88]], [[0.38, 0.918], [0.6, 0.928], [0.82, 0.928], [0.9, 0.916]]), look: 'tail', lamp: LAMP.tail, cells: [5, 1] },
    { region: strip('rear', [[0.3, 0.868], [0.39, 0.865]], 0.03), look: 'amber', kind: 'float', lamp: LAMP.left, cells: [2, 1] },
    { region: strip('rear', [[0, 0.55], [0.26, 0.55]], 0.11), look: 'plate', kind: 'float', cells: [4, 1] },
    { region: shutLine(-0.07, 0.29, -0.1, 0.97), look: 'seam', kind: 'float', cells: [5, 1], fine: true },
    { region: shutLine(-0.94, 0.3, -1.2, 0.98), look: 'seam', kind: 'float', cells: [5, 1], fine: true },
  ];
}

export const SALOON: CarShape = { ...SALOON_BASE, decals: saloonDecals(SALOON_BASE) };
