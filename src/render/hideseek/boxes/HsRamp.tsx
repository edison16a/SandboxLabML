'use client';

import { BoxBody, type BoxProps } from './BoxBody';

/** The hologram floats this far back from the lip edge, m, so it hangs over the high end. */
const HOLO_BACK = 0.4;

/**
 * One ramp: a jade wedge in the crate kit, with grip treads across its
 * slope and braced side panels (see bracedRamp). It drags, locks and
 * animates exactly like a crate; locked, its padlock hologram floats over
 * the lip in the owner team's color.
 */
export function HsRamp(props: Omit<BoxProps, 'kind'>) {
  return <BoxBody {...props} kind="ramp" holoX={props.size.length / 2 - HOLO_BACK} />;
}
