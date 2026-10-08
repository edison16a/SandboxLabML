import type { Cover } from './fit';

/**
 * The part of the Hide and Seek viewport the HUD cards in its bottom left
 * corner cover (the inputs card and the Sandbox setup), as shares of its
 * width and height. The lab writes it when the cards change size and the
 * Close view reads it every frame to keep the room clear of them, so it
 * is a plain shared object rather than store state.
 */
export const hudCover: Cover = { w: 0, h: 0 };
