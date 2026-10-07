/**
 * Colors for the Hide and Seek scene, as plain hex strings, taken from the
 * theme tokens where the UI has one (hider blue, seeker red) so the 3D and
 * the panels agree. The world is a bright, cool, high key grey: light
 * tiles, light grey walls and a grey block city fading into a pale haze,
 * so the team colors and the gold crates carry all the color. This file
 * loads no three.js, so the 2D maps, charts and previews take their colors
 * from here and never drift from the 3D scene.
 */
export const HS_COLORS = {
  /** Sky and haze: the background and the fog the far city fades into. */
  background: '#dfe3e9',
  /** The open ground the arenas and the city stand on, a shade darker than the tiles so each room reads. */
  ground: '#b2b7be',
  /** Albedo of the floor tiles, a light grey that leaves room for the sheen; the grout is a darker shade of it. */
  floor: '#bfc4cb',
  gridFloor: '#bfc4cb',
  /** The walls, lighter than the tiles, so their tops catch the light and frame each room as in the classic footage. */
  wall: '#d2d5db',
  gridWall: '#d2d5db',
  /**
   * The city blocks round the arenas, from the lightest to the darkest.
   * Even the lightest sits a little under the floor tiles, so the rooms
   * read first, as in the classic footage.
   */
  blockLight: '#bcc1c8',
  blockDark: '#858b95',
  hider: '#4c9aff',
  seeker: '#ff5f6d',
  /** The characters' bodies: the team colors deepened and saturated, since lit glossy color washes out on the bright floor. */
  hiderBody: '#2a87ff',
  seekerBody: '#ff2f48',
  /** Crates: cubes a rich gold, planks a warmer amber, so the two read apart at a glance. Shared with the 2D room maps. */
  cube: '#f0a91e',
  plank: '#e8872a',
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
