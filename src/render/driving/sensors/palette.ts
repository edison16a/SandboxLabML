import * as THREE from 'three';
import { HIT_CAR, HIT_PED, HIT_STATIC } from '@/engine/driving/sensors/lidar';
import { LIGHT_GREEN, LIGHT_RED, LIGHT_YELLOW } from '@/engine/driving/signals/plan';

/**
 * The sensor overlay's colors, one meaning each: the plan is a cool blue,
 * curbs and walls cyan, cars amber, people magenta. Brighter than 1 in
 * linear light so bloom gives them a soft halo on High.
 */
export const SENSOR = {
  route: new THREE.Color(0.25, 0.72, 1.6),
  accelerate: new THREE.Color(0.25, 1.5, 0.6),
  coast: new THREE.Color(0.9, 1.2, 1.6),
  brake: new THREE.Color(1.8, 0.35, 0.25),
  none: new THREE.Color(0.45, 0.6, 0.85),
  wall: new THREE.Color(0.2, 1.1, 1.5),
  car: new THREE.Color(1.7, 0.95, 0.2),
  person: new THREE.Color(1.8, 0.3, 1.0),
};

/** The overlay color for what a lidar beam hit. */
export function hitColor(kind: number): THREE.Color {
  if (kind === HIT_CAR) return SENSOR.car;
  if (kind === HIT_PED) return SENSOR.person;
  if (kind === HIT_STATIC) return SENSOR.wall;
  return SENSOR.none;
}

const RED = new THREE.Color(1.9, 0.18, 0.12);
const AMBER = new THREE.Color(1.9, 1.0, 0.1);
const GREEN = new THREE.Color(0.2, 1.7, 0.7);

/** The color of a light state, for the stop line and the highlight round the head being read. */
export function lightColor(state: number): THREE.Color {
  if (state === LIGHT_RED) return RED;
  if (state === LIGHT_YELLOW) return AMBER;
  if (state === LIGHT_GREEN) return GREEN;
  return AMBER;
}

/** CSS colors for the DOM labels, matching the 3D ones. */
export const SENSOR_CSS = { car: '#ffbf5c', person: '#ff6fb8', route: '#6fd2ff' };
