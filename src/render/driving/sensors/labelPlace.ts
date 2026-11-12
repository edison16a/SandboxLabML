import { CAR_ROOF } from '../traffic/shapes';

/** How far the distance pill's center floats above a car's roof, m. Enough that its lower edge clears the roof up close. */
const PILL_LIFT = 0.45;
/** How far the detection box's top edge stands above a car's roof, m. */
const BOX_LIFT = 0.1;
/** Heights for a person: the top of their box and their pill's center, m. */
export const PERSON_BOX_TOP = 1.95;
export const PERSON_PILL_Y = 2.25;

/** Height of the distance pill's center over a car of this body type, m. */
export function carPillY(kind: number): number {
  return (CAR_ROOF[kind] ?? CAR_ROOF[0]) + PILL_LIFT;
}

/** Height of the top of the detection box round a car of this body type, m. */
export function carBoxTop(kind: number): number {
  return (CAR_ROOF[kind] ?? CAR_ROOF[0]) + BOX_LIFT;
}
