/**
 * Colors for the Hide and Seek scene, as plain hex strings, taken from the
 * theme tokens where the UI has one (hider blue, seeker red) so the 3D and
 * the panels agree. The world is bright and airy: a pale haze, light stone
 * underfoot and white plaster walls, so the team colors and the gold
 * crates carry the color. This file loads no three.js, so the 2D maps,
 * charts and previews take their colors from here and never drift from
 * the 3D scene.
 */
export const HS_COLORS = {
  /** Sky and haze: the background and the fog the far backdrop fades into. */
  background: '#e6eaef',
  /** The open ground the arenas stand on, a shade darker than their floors so each room reads. */
  ground: '#d2d2d0',
  /** Multiplies the terrazzo texture of the showcase floor. */
  floor: '#fbf8f3',
  gridFloor: '#e7e5e0',
  /** Multiplies the plaster texture of the showcase walls. */
  wall: '#fdfbf7',
  gridWall: '#f8f7f4',
  hider: '#4c9aff',
  seeker: '#ff5f6d',
  /** Crates: cubes gold, planks a warmer ochre, so the two read apart at a glance. Shared with the 2D room maps. */
  cube: '#bf9a3e',
  plank: '#c28d45',
  /**
   * Ramps: a deep muted jade, so a ramp never reads as a crate or as either
   * team. Deep enough that its sunlit slope stays jade rather than mint.
   */
  ramp: '#4c8c70',
  sightClear: '#ff4d5e',
  sightBlocked: '#8a94a7',
  /** A sleeping character fades toward this, so a frozen seeker reads as switched off, near and far. */
  dormant: '#9aa0aa',
  /** The soft round shadow under every character and crate. */
  blobShadow: '#1a1712',
  /** The ray of a hovered input: dark ink, since white would vanish on the pale floor and walls. */
  rayHighlight: '#1d2433',
} as const;
