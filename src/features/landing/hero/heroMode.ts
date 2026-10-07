import type { QualityTier } from '@/features/racing/state/labStore';
import type { QualityPin } from '@/features/settings/settingsStore';

/** What the device can tell us before anything heavy loads. */
export interface HeroFacts {
  reducedMotion: boolean;
  /** The browser asked for less data (Save-Data). */
  saveData: boolean;
  /** Viewport size, CSS px. */
  width: number;
  height: number;
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

/**
 * The smallest window that plays the live hero, CSS px. Below it the brain
 * card, the part that shows a real network drives the scene, has no room
 * beside the centered text and is hidden, and a moving picture without it
 * is not worth two 3D scenes. Keep it in step with the hero-cards variant
 * in app/globals.css, which shows the cards.
 */
export const LIVE_MIN_WIDTH = 1024;
export const LIVE_MIN_HEIGHT = 560;

/** A touch screen whose shorter side is under this is a phone, whichever way it is held. */
export const PHONE_SCREEN_SHORT = 768;

/** A phone, told from the device rather than the window, so one held sideways still counts. */
function isPhone(f: HeroFacts): boolean {
  return f.coarsePointer && f.screenShort > 0 && f.screenShort < PHONE_SCREEN_SHORT;
}

/**
 * Whether this device plays the live hero. Two 3D scenes and a worker are
 * a real load, so the hero stays a still picture for anyone who asked for
 * less motion or data, on phones, in windows too small for the brain card,
 * and on machines too small to run them smoothly. Unknown values count as capable, as most
 * browsers that hide them are desktop ones.
 */
export function heroMode(f: HeroFacts): HeroMode {
  if (f.reducedMotion || f.saveData || !f.webgl2) return 'poster';
  if (f.width < LIVE_MIN_WIDTH || f.height < LIVE_MIN_HEIGHT || isPhone(f)) return 'poster';
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
