import { create } from 'zustand';

/** How often the 3D views may draw. Max draws on every display frame. */
export type FrameRate = '30' | '60' | 'max';
/** Render quality picked in Settings. Each lab maps it onto its own tiers. */
export type Quality = 'low' | 'medium' | 'high';
/** A quality pinned by ?quality= in the address. Ultra is only reachable this way, for screenshots. */
export type QualityPin = Quality | 'ultra';

const KEY = 'sandboxlab.settings';
const RATES: readonly FrameRate[] = ['30', '60', 'max'];
const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];
const PINS: readonly QualityPin[] = [...QUALITIES, 'ultra'];

interface Saved {
  frameRate: FrameRate;
  quality: Quality | null;
}

/** Reads the saved choices. Storage can be missing or blocked (private windows, tests), so every access is guarded. */
function load(): Saved {
  const fallback: Saved = { frameRate: '60', quality: null };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
    return {
      frameRate: RATES.includes(raw.frameRate as FrameRate) ? (raw.frameRate as FrameRate) : fallback.frameRate,
      quality: QUALITIES.includes(raw.quality as Quality) ? (raw.quality as Quality) : null,
    };
  } catch {
    return fallback;
  }
}

function save(s: Saved) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Settings still apply for this visit; they just will not be remembered.
  }
}

/** Reads ?quality= into a pin, or null when it is missing or not a known tier. */
export function parseQualityPin(value: string | null): QualityPin | null {
  return PINS.includes(value as QualityPin) ? (value as QualityPin) : null;
}

/**
 * App wide display settings. They only change how the labs draw, never a
 * training result, so they live outside the lab stores and apply to both.
 */
export interface SettingsState {
  frameRate: FrameRate;
  /** Null until someone picks a quality. The GPU then decides the default. */
  quality: Quality | null;
  /** Set from ?quality= by the lab that is open. It wins over the saved choice until a quality is picked here. */
  pinned: QualityPin | null;
  /** An integrated or software GPU. Null until a lab probes it. */
  weakGpu: boolean | null;

  setFrameRate: (rate: FrameRate) => void;
  setQuality: (quality: Quality) => void;
  setPinned: (pin: QualityPin | null) => void;
  setWeakGpu: (weak: boolean) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  pinned: null,
  weakGpu: null,

  setFrameRate: (frameRate) => {
    set({ frameRate });
    save({ frameRate, quality: get().quality });
  },
  // Picking a quality here is the newest intent, so it also drops a pin from the address.
  setQuality: (quality) => {
    set({ quality, pinned: null });
    save({ frameRate: get().frameRate, quality });
  },
  setPinned: (pinned) => set({ pinned }),
  setWeakGpu: (weakGpu) => set({ weakGpu }),
}));

/**
 * The quality the labs draw at: a pin from the address, then the saved
 * choice, then a default from the GPU. High suits a discrete GPU; an
 * integrated or software one starts on Medium.
 */
export function resolvedQuality(s: Pick<SettingsState, 'pinned' | 'quality' | 'weakGpu'>): QualityPin {
  return s.pinned ?? s.quality ?? (s.weakGpu ? 'medium' : 'high');
}

/** Whether a person chose the quality, by picking it in Settings or pinning it in the address. */
export function qualityChosen(s: Pick<SettingsState, 'pinned' | 'quality'>): boolean {
  return s.pinned !== null || s.quality !== null;
}

/** Frames per second for a rate, or null for no cap. */
export function fpsCap(rate: FrameRate): number | null {
  return rate === 'max' ? null : Number(rate);
}
