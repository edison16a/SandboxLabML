import type { BoxSize } from '@/engine/hideseek/physics';

/** A point in a ramp's own frame seen from above: x along the slope, y across it, m. */
export type RampPoint = readonly [number, number];

/** One chevron as three points: the end of one arm, the tip, the end of the other arm. */
export type Chevron = readonly [RampPoint, RampPoint, RampPoint];

/** How far the arms reach across the ramp, as a share of its width. */
const SPREAD = 0.3;
/** How far back from the tip the arms end, as a share of the width. Just under the spread, so each chevron reads as an arrowhead. */
const DEPTH = 0.26;

/**
 * Chevrons that point uphill on a ramp seen from above, in its frame: x
 * runs from the foot (-length / 2) to the lip (+length / 2), the way a
 * ramp's yaw points. They are spread evenly along the slope, so with the
 * frame turned by the ramp's yaw they show which end is high on every 2D
 * map: the room editor, the room thumbnails and the lesson preview.
 */
export function rampChevrons(size: Pick<BoxSize, 'length' | 'width'>, count: number): Chevron[] {
  const spread = SPREAD * size.width;
  const depth = DEPTH * size.width;
  const step = size.length / (count + 1);
  return Array.from({ length: count }, (_, k): Chevron => {
    // Centered on its slot, so the row of chevrons sits in the middle of the slope.
    const tip = -size.length / 2 + step * (k + 1) + depth / 2;
    return [
      [tip - depth, -spread],
      [tip, 0],
      [tip - depth, spread],
    ];
  });
}

/** A chevron as an SVG points attribute. */
export function chevronPoints(c: Chevron): string {
  return c.map(([x, y]) => `${x},${y}`).join(' ');
}

/**
 * The SVG transform that places a box's own frame on a map whose x and y
 * are the room's x and z. Yaw turns counterclockwise seen from above while
 * SVG turns clockwise, hence the minus.
 */
export function boxTransform(b: { x: number; z: number; yaw: number }): string {
  return `translate(${b.x} ${b.z}) rotate(${(-b.yaw * 180) / Math.PI})`;
}
