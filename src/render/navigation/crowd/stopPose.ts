import { FLAG_CRUSHED, NAV_DIED, NAV_FINISHED, NAV_RUNNING } from '@/engine/navigation/agent';

/**
 * How a character is drawn once its run has ended, on top of where it
 * stands: tipped over, squashed flat, hopping for joy or fading out. The
 * champion and the crowd use the same numbers, so the hand over from one
 * to the other never shows.
 */
export interface StopPose {
  /** Tip about the feet, rad: positive falls forward, negative onto its back. */
  tip: number;
  /** Height scale, and width scale across the floor. */
  squash: number;
  spread: number;
  /** Extra scale along the axis a mover pushed it, on top of spread: under 1 flattens it against the wall. See crushAxis. */
  thin: number;
  /** Raised off the floor, m. */
  lift: number;
  /** Extra turn about its own axis, rad. */
  spin: number;
  /** Opacity, 0 to 1. Gone at 0. */
  alpha: number;
  /** How far its color has gone grey, 0 to 1. */
  grey: number;
  /** In the air: a celebratory hop, or the jolt off the spikes. */
  airborne: boolean;
  /** A red flash on the body at the moment of death, 1 fading to 0. */
  flash: number;
}

/** Seconds a fall takes to land (after the jolt starts it), then the time the body lies before it fades, and the fade. */
const FALL = 0.5;
/** The jolt off the spikes: how long it lasts and how high it throws the body, s and m. */
const JOLT = 0.3;
const JOLT_HEIGHT = 0.3;
export const FADE_START = { died: 0.9, crushed: 0.5, finished: 1, stopped: 0.2 };
const FADE_LENGTH = { died: 0.9, crushed: 0.8, finished: 0.8, stopped: 0.9 };
/** A crushed body pops up this far as it is squeezed out, m, over this long, s. */
const SQUEEZE_UP = 0.24;
const SQUEEZE = 0.45;
/** A body lying flat keeps its head and back out of the floor by this much at full tip, m. */
const LYING_LIFT = 0.34;

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function reset(out: StopPose): StopPose {
  out.tip = 0;
  out.squash = 1;
  out.spread = 1;
  out.thin = 1;
  out.lift = 0;
  out.spin = 0;
  out.alpha = 1;
  out.grey = 0;
  out.airborne = false;
  out.flash = 0;
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
    // Pressed flat against the wall in a blink, along the push, and squeezed up a little so it shows over the mover; then it fades.
    const k = smooth(0, 0.12, a);
    out.thin = 1 - 0.72 * k;
    out.spread = 1 + 0.22 * k;
    out.squash = 1 - 0.1 * k;
    out.lift = SQUEEZE_UP * Math.sin(Math.PI * Math.min(1, a / SQUEEZE));
    out.flash = Math.max(0, 1 - a / 0.45);
    out.grey = 0.5 * smooth(0, 0.4, a);
    out.alpha = 1 - smooth(FADE_START.crushed, FADE_START.crushed + FADE_LENGTH.crushed, a);
    return out;
  }
  if (status === NAV_DIED) {
    // Jolted up off the spikes, then down onto its back with a small bounce, so from behind the view sees its face.
    const t = Math.min(1, a / FALL);
    const land = 1 - (1 - t) ** 3;
    const bounce = a > FALL ? 0.08 * Math.sin((a - FALL) * 18) * Math.exp(-(a - FALL) * 7) : 0;
    out.tip = -((Math.PI / 2 - 0.12) * land - bounce);
    const jolt = a < JOLT ? Math.sin((a / JOLT) * Math.PI) * JOLT_HEIGHT : 0;
    out.lift = jolt + Math.sin(-out.tip) * LYING_LIFT;
    out.airborne = jolt > 0.05;
    out.flash = Math.max(0, 1 - a / 0.45);
    out.grey = 0.55 * smooth(0.3, 0.9, a);
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
