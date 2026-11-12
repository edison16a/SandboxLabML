import type { Rect } from './splitLayout';

/** The three shapes the hero poster comes in: wide screens, squarer windows and portrait screens. */
export type PosterFrameKind = 'wide' | 'standard' | 'portrait';

/**
 * One poster shape as scripts/capture-hero-poster.mjs shoots it: the
 * hero's size in CSS px and where the text panel sat in it. The live
 * scenes compose their shots for this frame and show the part of it the
 * window keeps, exactly as the poster image is cropped, so the poster and
 * the first live frame line up at any window size.
 */
export interface PosterFrame {
  kind: PosterFrameKind;
  width: number;
  height: number;
  panel: Rect;
}

/**
 * Measured on the capture windows (1920 x 1128 and 1440 x 1128 at 4/3
 * scale, 1024 x 1868 with the panel stretched to a phone's 60%). The
 * capture script checks the page still measures this before it shoots.
 */
export const POSTER_FRAMES: Readonly<Record<PosterFrameKind, PosterFrame>> = {
  wide: { kind: 'wide', width: 1920, height: 1080, panel: { x: 656, y: 334, w: 608, h: 413 } },
  standard: { kind: 'standard', width: 1440, height: 1080, panel: { x: 448, y: 342, w: 544, h: 395 } },
  portrait: { kind: 'portrait', width: 1024, height: 1820, panel: { x: 272, y: 364, w: 480, h: 1092 } },
};

/** Where a frame lands when it covers a hero of `width` x `height`, centered, the way object-fit: cover draws the poster. */
export interface Cover {
  scale: number;
  /** The frame's top left corner, CSS px from the hero's top left. At most 0, since the frame covers the hero. */
  x: number;
  y: number;
}

export function coverFrame(frame: PosterFrame, width: number, height: number): Cover {
  const scale = Math.max(width / frame.width, height / frame.height);
  return { scale, x: (width - frame.width * scale) / 2, y: (height - frame.height * scale) / 2 };
}
