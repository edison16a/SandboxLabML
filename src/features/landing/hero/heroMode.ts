import type { QualityTier } from '@/features/racing/state/labStore';
import type { QualityPin } from '@/features/settings/settingsStore';

/** What the device can tell us before anything heavy loads. */
export interface HeroFacts {
  reducedMotion: boolean;
  /** The browser asked for less data (Save-Data). */
  saveData: boolean;
  /** Viewport width, CSS px. */
  width: number;
  /** The main pointer is a finger (pointer: coarse), as on phones and tablets. */
  coarsePointer: boolean;
  /** The shorter side of the device screen, CSS px. Unlike the viewport, it stays the same when a phone turns sideways. */
  screenShort: number;
  /** Logical cores, or 0 when the browser does not say. */
  cores: number;
  /** Device memory in GB, or null when the browser does not say. */
  memoryGb: number | null;
  webgl2: boolean;
}

/** The still poster only, or the poster first and then the live scenes. */
export type HeroMode = 'poster' | 'live';

/** Below this width a phone gets the poster: the live scenes would cost a lot of battery behind a few lines of text. */
export const LIVE_MIN_WIDTH = 768;

/** A touch screen whose shorter side is under this is a phone, whichever way it is held. */
export const PHONE_SCREEN_SHORT = 768;

/** A phone, told from the device rather than the window, so one held sideways still counts. */
function isPhone(f: HeroFacts): boolean {
  return f.coarsePointer && f.screenShort > 0 && f.screenShort < PHONE_SCREEN_SHORT;
}

/**
 * Whether this device plays the live hero. Two 3D scenes and a worker are
 * a real load, so the hero stays a still picture for anyone who asked for
 * less motion or data, on phones and narrow screens, and on machines too
 * small to run them smoothly. Unknown values count as capable, as most
 * browsers that hide them are desktop ones.
 */
export function heroMode(f: HeroFacts): HeroMode {
  if (f.reducedMotion || f.saveData || !f.webgl2) return 'poster';
  if (f.width < LIVE_MIN_WIDTH || isPhone(f)) return 'poster';
  if (f.cores > 0 && f.cores < 4) return 'poster';
  if (f.memoryGb !== null && f.memoryGb < 4) return 'poster';
  return 'live';
}

/**
 * The tier both hero scenes draw at. A quality picked in Settings, or
 * pinned with ?quality=, is used as is, stopping at High since Ultra is
 * only for lab screenshots. Otherwise the hero starts a step below the
 * labs' default: it fills the whole screen behind a scrim, where fine
 * detail barely shows, and a first visit should never stutter.
 */
export function heroTier(quality: QualityPin, chosen: boolean, weakGpu: boolean): QualityTier {
  if (!chosen) return weakGpu ? 'low' : 'medium';
  return quality === 'ultra' ? 'high' : quality;
}
