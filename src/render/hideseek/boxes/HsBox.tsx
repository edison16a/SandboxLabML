'use client';

import { BoxBody, type BoxProps } from './BoxBody';
import { HsRamp } from './HsRamp';

export type { BoxDrive, BoxProps } from './BoxBody';

/**
 * One braced crate: gold panels in a light frame, with the padlock
 * hologram over its middle when locked (see BoxBody).
 */
export function HsBox(props: BoxProps) {
  return <BoxBody {...props} holoX={0} />;
}

/** The right box for a kind: a ramp for ramps, a crate for cubes and planks. */
export function BoxOfKind(props: BoxProps) {
  return props.kind === 'ramp' ? <HsRamp {...props} /> : <HsBox {...props} />;
}
