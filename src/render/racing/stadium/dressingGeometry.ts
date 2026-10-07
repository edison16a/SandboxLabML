import * as THREE from 'three';
import { ColoredParts } from './coloredParts';

const STEEL = new THREE.Color('#59616b');
const DARK = new THREE.Color('#262b31');
const LAMP = new THREE.Color('#e9eef2');

/** Floodlight tower height, m. */
export const TOWER_HEIGHT = 27;

/**
 * A floodlight tower: a tapered steel mast with a ladder spine and a tilted
 * head of lamps facing the circuit (local -z). Daytime, so lamps are off and
 * just read as pale glass.
 */
export function towerGeometry(): THREE.BufferGeometry {
  const b = new ColoredParts();
  b.add(new THREE.CylinderGeometry(0.22, 0.42, TOWER_HEIGHT, 10).translate(0, TOWER_HEIGHT / 2, 0), STEEL);
  b.box(0.12, TOWER_HEIGHT - 2, 0.12, 0.42, TOWER_HEIGHT / 2, 0, DARK);
  const head = new ColoredParts();
  head.box(4.2, 2.6, 0.35, 0, 0, 0, DARK);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) head.box(0.62, 0.55, 0.12, -1.6 + c * 0.8, -0.8 + r * 0.8, -0.22, LAMP);
  const g = head.build().rotateX(0.35).translate(0, TOWER_HEIGHT + 0.6, -0.4);
  b.add(g, null);
  return b.build();
}

/** A flag pole, 3.2 m, its top at the origin's +3.2. */
export function poleGeometry(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.035, 0.05, 3.2, 6).translate(0, 1.6, 0);
}

/** Board size, m. */
export const BOARD = { w: 9, h: 2.4, lift: 1.4 };

/** A trackside board's frame and legs; the printed face is drawn separately. */
export function boardFrameGeometry(): THREE.BufferGeometry {
  const b = new ColoredParts();
  b.box(BOARD.w + 0.3, BOARD.h + 0.3, 0.16, 0, BOARD.lift + BOARD.h / 2, 0.1, DARK);
  for (const s of [-1, 1]) b.box(0.16, BOARD.lift + BOARD.h, 0.16, s * BOARD.w * 0.35, (BOARD.lift + BOARD.h) / 2, 0.22, STEEL);
  return b.build();
}
