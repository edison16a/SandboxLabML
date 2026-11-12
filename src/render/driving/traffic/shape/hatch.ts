import { CAR_DIMENSIONS, CAR_HATCH } from '@/engine/driving/world/state';
import { LAMP } from '../looks';
import { pillar, shutLine, sideGlass, strip, topGlass } from './outlines';
import type { CarShape, Decal } from './types';

const [length, width] = CAR_DIMENSIONS[CAR_HATCH];

/**
 * The hatchback: a compact five door with a short nose, a long roof and
 * an upright tail whose glass leans back only a little. x runs from the
 * tail (-2.05) to the nose (+2.05).
 */
const BASE: CarShape = {
  kind: CAR_HATCH,
  length,
  width,
  wheelbase: 2.62,
  wheelRadius: 0.33,
  axleShift: 0.03,
  track: width / 2 - 0.13,
  nose: { reach: 0.56, square: 2.6, lean: 0.05, leanAt: 0.48 },
  tail: { reach: 0.36, square: 3.2, lean: 0.06, leanAt: 0.64 },
  sill: [[-2.05, 0.37], [-1.85, 0.3], [-1.6, 0.225], [-1.0, 0.21], [1.0, 0.21], [1.6, 0.235], [1.86, 0.29], [2.05, 0.33]],
  trim: [[-2.05, 0.47], [-1.85, 0.42], [-1.6, 0.29], [-1.0, 0.26], [1.0, 0.26], [1.6, 0.3], [1.84, 0.37], [2.05, 0.39]],
  waist: [[-2.05, 0.6], [0, 0.56], [2.05, 0.54]],
  shoulder: [[-2.05, 0.845], [-1.4, 0.84], [0, 0.8], [1.3, 0.77], [2.05, 0.71]],
  belt: [[-2.05, 0.975], [-1.6, 0.985], [-1.1, 0.97], [0, 0.94], [0.85, 0.92], [1.3, 0.865], [1.75, 0.795], [2.05, 0.745]],
  top: [[-2.05, 1.0], [-2.0, 1.07], [-1.9, 1.2], [-1.78, 1.31], [-1.62, 1.375], [-1.4, 1.405], [-0.7, 1.425], [0.1, 1.405], [0.5, 1.22], [0.92, 0.99], [1.5, 0.885], [1.85, 0.83], [2.0, 0.785], [2.05, 0.76]],
  crown: [[-2.05, 0], [-1.95, 0.02], [-1.6, 0.032], [0.2, 0.036], [0.9, 0.03], [1.4, 0.02], [2.05, 0]],
  corner: [[-2.05, 0.02], [-1.8, 0.04], [-1.4, 0.048], [0.3, 0.048], [0.8, 0.04], [1.2, 0.02], [2.05, 0.01]],
  beltIn: [[-2.05, 0.05], [0, 0.06], [2.05, 0.05]],
  sideIn: [[-2.05, 0.13], [-1.7, 0.18], [-1.2, 0.22], [0.3, 0.22], [0.9, 0.15], [1.3, 0.1], [2.05, 0.1]],
  topIn: [[-2.05, 0.2], [-1.7, 0.26], [-1.2, 0.3], [0.3, 0.3], [0.9, 0.24], [1.3, 0.19], [2.05, 0.17]],
  decals: [],
  mirror: { x: 0.8, y: 1.0, out: 0.15 },
  roofSign: false,
};

function hatchDecals(s: CarShape): Decal[] {
  const side = sideGlass(s, { cTop: -1.22, rearTip: -1.52, drop: 0.026 });
  const screen = topGlass(s, { low: 0.92, high: 0.22, bow: 0.09, margin: 0.03 });
  // The tail glass stands nearly upright, so it is drawn from behind rather than from above.
  const back = { view: 'rear' as const, bottom: [[0, 1.06], [0.3, 1.065], [0.54, 1.08]] as Array<[number, number]>, top: [[0, 1.31], [0.3, 1.31], [0.46, 1.3]] as Array<[number, number]> };
  return [
    { region: side, look: 'trim', kind: 'ring', grow: 0.022, cells: [8, 2], fine: true },
    { region: side, look: 'glass', cells: [8, 2] },
    { region: pillar(s, -0.12, 0.075, 0.03), look: 'trim', kind: 'float', cells: [1, 3], fine: true },
    { region: screen, look: 'trim', kind: 'ring', grow: 0.02, cells: [3, 4], fine: true },
    { region: screen, look: 'glass', cells: [3, 4] },
    { region: back, look: 'trim', kind: 'ring', grow: 0.02, cells: [3, 4], fine: true },
    { region: back, look: 'glass', cells: [3, 4] },
    { region: strip('rear', [[0, 1.325], [0.22, 1.325]], 0.016), look: 'tail', kind: 'float', lamp: LAMP.brake, cells: [2, 1], fine: true },
    // Head lamps: a little taller than the saloon's, their inner ends dipping toward the grille.
    { region: strip('front', [[0.4, 0.655], [0.6, 0.66], [0.76, 0.672], [0.85, 0.69]], [[0.38, 0.72], [0.6, 0.735], [0.76, 0.735], [0.845, 0.72]]), look: 'head', cells: [5, 1] },
    { region: strip('front', [[0.44, 0.703], [0.6, 0.714], [0.76, 0.716], [0.83, 0.708]], 0.009), look: 'drl', kind: 'float', lamp: LAMP.head, cells: [7, 1] },
    { region: strip('front', [[0.46, 0.665], [0.66, 0.67]], 0.026), look: 'lens', kind: 'float', cells: [3, 1], fine: true },
    { region: strip('front', [[0.76, 0.678], [0.84, 0.694]], 0.018), look: 'amber', kind: 'float', lamp: LAMP.right, cells: [3, 1] },
    { region: strip('front', [[0, 0.665], [0.37, 0.668]], [[0, 0.71], [0.36, 0.716]]), look: 'grille', kind: 'float', cells: [3, 1] },
    { region: strip('front', [[0, 0.4], [0.42, 0.405], [0.56, 0.43]], [[0, 0.54], [0.44, 0.54], [0.53, 0.51]]), look: 'grille', cells: [4, 1] },
    // Tail lamps run out under the glass and wrap round onto the sides; the indicator is their inner end.
    { region: strip('rear', [[0.44, 0.92], [0.66, 0.915], [0.84, 0.93]], [[0.44, 1.005], [0.66, 1.015], [0.83, 1.005]]), look: 'tail', lamp: LAMP.tail, cells: [5, 1] },
    { region: strip('side', [[-1.9, 0.924], [-1.8, 0.932], [-1.7, 0.945]], [[-1.9, 1.008], [-1.8, 1.0], [-1.7, 0.958]]), look: 'tail', kind: 'float', lamp: LAMP.tail, cells: [3, 1] },
    { region: strip('rear', [[0.45, 0.93], [0.53, 0.928]], 0.028), look: 'amber', kind: 'float', lamp: LAMP.right, cells: [2, 1] },
    { region: strip('rear', [[0, 0.62], [0.26, 0.62]], 0.11), look: 'plate', kind: 'float', cells: [4, 1] },
    { region: shutLine(-0.1, 0.29, -0.13, 0.97), look: 'seam', kind: 'float', cells: [5, 1], fine: true },
    { region: shutLine(-0.875, 0.29, -1.05, 0.955), look: 'seam', kind: 'float', cells: [5, 1], fine: true },
  ];
}

export const HATCH: CarShape = { ...BASE, decals: hatchDecals(BASE) };
