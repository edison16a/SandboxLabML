import type { PosterFrameKind } from '@/render/hero/stage/posterFrame';

/** Portrait windows, phones and tablets alike, take the portrait poster with the scenes stacked. */
export const PORTRAIT_MEDIA = '(orientation: portrait)';
/** Windows no wider than 3:2 take the 4:3 frames: a 4:3 hero crops a 16:9 frame too hard at the sides. */
export const STANDARD_MEDIA = '(orientation: landscape) and (max-aspect-ratio: 3/2)';

/**
 * The poster frame the browser picks for this window, by the very media
 * queries the poster's picture element uses, so the live scenes compose
 * their shots for the still that is really under them.
 */
export function posterFrameKind(matches: (query: string) => boolean): PosterFrameKind {
  if (matches(PORTRAIT_MEDIA)) return 'portrait';
  return matches(STANDARD_MEDIA) ? 'standard' : 'wide';
}
