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
  tail: { reach: 0.34, square: 3.4, lean: 0.035, leanAt: 0.72 },
  sill: [[-2.05, 0.37], [-1.85, 0.3], [-1.6, 0.225], [-1.0, 0.21], [1.0, 0.21], [1.6, 0.235], [1.86, 0.29], [2.05, 0.33]],
  trim: [[-2.05, 0.47], [-1.85, 0.42], [-1.6, 0.29], [-1.0, 0.26], [1.0, 0.26], [1.6, 0.3], [1.84, 0.37], [2.05, 0.39]],
  waist: [[-2.05, 0.6], [0, 0.56], [2.05, 0.54]],
  shoulder: [[-2.05, 0.88], [-1.4, 0.87], [0, 0.82], [1.3, 0.78], [2.05, 0.71]],
  belt: [[-2.05, 1.02], [-1.6, 1.03], [-1.0, 1.0], [0, 0.975], [0.85, 0.95], [1.3, 0.88], [1.75, 0.8], [2.05, 0.745]],
  top: [[-2.05, 1.03], [-2.0, 1.08], [-1.92, 1.2], [-1.82, 1.34], [-1.72, 1.41], [-1.5, 1.45], [-0.6, 1.475], [0.15, 1.445], [0.55, 1.24], [0.95, 1.0], [1.5, 0.9], [1.85, 0.84], [2.0, 0.79], [2.05, 0.765]],
  crown: [[-2.05, 0], [-1.95, 0.02], [-1.6, 0.04], [0.2, 0.045], [0.9, 0.035], [1.4, 0.02], [2.05, 0]],
  corner: [[-2.05, 0.02], [-1.8, 0.05], [-1.4, 0.07], [0.3, 0.07], [0.8, 0.05], [1.2, 0.02], [2.05, 0.01]],
  beltIn: [[-2.05, 0.05], [0, 0.06], [2.05, 0.05]],
  sideIn: [[-2.05, 0.13], [-1.7, 0.18], [-1.2, 0.22], [0.3, 0.22], [0.9, 0.15], [1.3, 0.1], [2.05, 0.1]],
  topIn: [[-2.05, 0.2], [-1.7, 0.26], [-1.2, 0.3], [0.3, 0.3], [0.9, 0.24], [1.3, 0.19], [2.05, 0.17]],
  decals: [],
  mirror: { x: 0.8, y: 1.0, out: 0.15 },
  roofSign: false,
};

function hatchDecals(s: CarShape): Decal[] {
  const side = sideGlass(s, { cTop: -1.32, rearTip: -1.6, drop: 0.026 });
  const screen = topGlass(s, { low: 0.92, high: 0.22, bow: 0.09, margin: 0.03 });
  // The tail glass stands nearly upright, so it is drawn from behind rather than from above.
  const back = { view: 'rear' as const, bottom: [[0, 1.1], [0.3, 1.105], [0.52, 1.12]] as Array<[number, number]>, top: [[0, 1.37], [0.3, 1.37], [0.46, 1.36]] as Array<[number, number]> };
  return [
    { region: side, look: 'trim', kind: 'ring', grow: 0.022, cells: [8, 2], fine: true },
    { region: side, look: 'glass', cells: [8, 2] },
    { region: pillar(s, -0.12, 0.075, 0.03), look: 'trim', kind: 'float', cells: [1, 3], fine: true },
    { region: pillar(s, -1.12, 0.06, 0.06), look: 'trim', kind: 'float', cells: [1, 3], fine: true },
    { region: screen, look: 'trim', kind: 'ring', grow: 0.02, cells: [3, 4], fine: true },
    { region: screen, look: 'glass', cells: [3, 4] },
    { region: back, look: 'trim', kind: 'ring', grow: 0.02, cells: [3, 4], fine: true },
    { region: back, look: 'glass', cells: [3, 4] },
    { region: strip('rear', [[0, 1.385], [0.22, 1.385]], 0.018), look: 'tail', kind: 'float', lamp: LAMP.brake, cells: [2, 1], fine: true },
    // Head lamps: a little taller than the saloon's, their inner ends dipping toward the grille.
    { region: strip('front', [[0.4, 0.655], [0.6, 0.66], [0.76, 0.672], [0.85, 0.69]], [[0.38, 0.72], [0.6, 0.735], [0.76, 0.735], [0.845, 0.72]]), look: 'head', cells: [5, 1] },
    { region: strip('front', [[0.44, 0.703], [0.6, 0.714], [0.76, 0.716], [0.83, 0.708]], 0.009), look: 'drl', kind: 'float', lamp: LAMP.head, cells: [7, 1] },
    { region: strip('front', [[0.46, 0.665], [0.66, 0.67]], 0.026), look: 'lens', kind: 'float', cells: [3, 1], fine: true },
    { region: strip('front', [[0.76, 0.678], [0.84, 0.694]], 0.018), look: 'amber', kind: 'float', lamp: LAMP.left, cells: [3, 1] },
    { region: strip('front', [[0, 0.665], [0.37, 0.668]], [[0, 0.71], [0.36, 0.716]]), look: 'grille', kind: 'float', cells: [3, 1] },
    { region: strip('front', [[0, 0.4], [0.42, 0.405], [0.56, 0.43]], [[0, 0.54], [0.44, 0.54], [0.53, 0.51]]), look: 'grille', kind: 'float', cells: [4, 1] },
    // Tail lamps stand up the rear corners and wrap round onto the sides.
    { region: strip('rear', [[0.52, 0.86], [0.7, 0.858], [0.84, 0.87]], [[0.54, 1.02], [0.7, 1.03], [0.82, 1.02]]), look: 'tail', lamp: LAMP.tail, cells: [5, 1] },
    { region: strip('rear', [[0.56, 0.87], [0.72, 0.868]], 0.035), look: 'amber', kind: 'float', lamp: LAMP.left, cells: [3, 1] },
    { region: strip('rear', [[0, 0.62], [0.26, 0.62]], 0.11), look: 'plate', kind: 'float', cells: [4, 1] },
    { region: shutLine(-0.1, 0.29, -0.13, 0.97), look: 'seam', kind: 'float', cells: [5, 1], fine: true },
    { region: shutLine(-0.88, 0.29, -1.08, 0.99), look: 'seam', kind: 'float', cells: [5, 1], fine: true },
  ];
}

export const HATCH: CarShape = { ...BASE, decals: hatchDecals(BASE) };
