import { FLAG_CRUSHED, NAV_DIED, NAV_FINISHED, NAV_RUNNING } from '@/engine/navigation/agent';

/**
 * How a character is drawn once its run has ended, on top of where it
 * stands: tipped over, squashed flat, hopping for joy or fading out. The
 * champion and the crowd use the same numbers, so the hand over from one
 * to the other never shows.
 */
export interface StopPose {
  /** Forward tip about the feet, rad. */
  tip: number;
  /** Height scale, and width scale across the floor. */
  squash: number;
  spread: number;
  /** Raised off the floor, m. */
  lift: number;
  /** Extra turn about its own axis, rad. */
  spin: number;
  /** Opacity, 0 to 1. Gone at 0. */
  alpha: number;
  /** How far its color has gone grey, 0 to 1. */
  grey: number;
  /** In the air in a celebratory hop. */
  airborne: boolean;
}

/** Seconds a fall takes to land, then the time the body lies before it fades, and the fade. */
const FALL = 0.42;
export const FADE_START = { died: 0.9, crushed: 0.5, finished: 1, stopped: 0.2 };
const FADE_LENGTH = { died: 0.9, crushed: 0.8, finished: 0.8, stopped: 0.9 };
/** A body lying on its front keeps its head out of the floor by this much at full tip, m. */
const LYING_LIFT = 0.34;

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function reset(out: StopPose): StopPose {
  out.tip = 0;
  out.squash = 1;
  out.spread = 1;
  out.lift = 0;
  out.spin = 0;
  out.alpha = 1;
  out.grey = 0;
  out.airborne = false;
  return out;
}

/**
 * The pose for status `status` (NAV_*) with snapshot flags `flags`, `age`
 * seconds after its run ended. Running agents get the plain pose. Pure,
 * so it can be tested and costs nothing per agent.
 */
export function stopPose(status: number, flags: number, age: number, out: StopPose): StopPose {
  reset(out);
  if (status === NAV_RUNNING) return out;
  const a = Math.max(0, age);
  if (status === NAV_DIED && flags & FLAG_CRUSHED) {
    // Flattened in a blink, then it fades.
    const k = smooth(0, 0.12, a);
    out.squash = 1 - 0.72 * k;
    out.spread = 1 + 0.36 * k;
    out.grey = 0.5 * smooth(0, 0.4, a);
    out.alpha = 1 - smooth(FADE_START.crushed, FADE_START.crushed + FADE_LENGTH.crushed, a);
    return out;
  }
  if (status === NAV_DIED) {
    // Falls forward onto its front with a small bounce on landing.
    const t = Math.min(1, a / FALL);
    const land = 1 - (1 - t) ** 3;
    const bounce = a > FALL ? 0.09 * Math.sin((a - FALL) * 18) * Math.exp(-(a - FALL) * 7) : 0;
    out.tip = (Math.PI / 2 - 0.1) * land - bounce;
    out.lift = Math.sin(out.tip) * LYING_LIFT;
    out.grey = 0.55 * smooth(0.2, 0.8, a);
    out.alpha = 1 - smooth(FADE_START.died, FADE_START.died + FADE_LENGTH.died, a);
    return out;
  }
  if (status === NAV_FINISHED) {
    // Two little hops and a full turn, then it fades out past the line.
    const hops = Math.max(0, 1 - a / 1.1);
    out.lift = Math.abs(Math.sin(a * 8.5)) * 0.3 * hops;
    out.airborne = out.lift > 0.05;
    out.spin = smooth(0, 0.95, a) * Math.PI * 2;
    out.alpha = 1 - smooth(FADE_START.finished, FADE_START.finished + FADE_LENGTH.finished, a);
    return out;
  }
  // Out of time or stuck: it greys and fades where it stands.
  out.grey = 0.7 * smooth(0, 0.5, a);
  out.alpha = 1 - smooth(FADE_START.stopped, FADE_START.stopped + FADE_LENGTH.stopped, a);
  return out;
}

export function createStopPose(): StopPose {
  return reset({} as StopPose);
}
