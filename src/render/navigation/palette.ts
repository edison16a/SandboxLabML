/**
 * Colors of the Navigation scene, as plain hex strings, so 2D code (the
 * course thumbnails, the editor board, the lesson previews) shares them
 * without loading three.js. The world is a bright, cool, high key grey:
 * light tiles, light grey walls and a grey block city fading into a pale
 * haze, so the runners, the gold crates and the hazards carry the color.
 */
export const NAV_COLORS = {
  /** Sky and haze: the background and the fog the far city fades into. */
  background: '#dfe3e9',
  /** The open ground the room and the city stand on, a shade darker than the tiles so the room reads. */
  ground: '#b2b7be',
  /** Albedo of the floor tiles, a light grey that leaves room for the sheen; the grout is a darker shade of it. */
  floor: '#bfc4cb',
  /** The walls, lighter than the tiles, so their tops catch the light and frame the room. */
  wall: '#d2d5db',
  /** The city blocks round the room, from the lightest to the darkest. Even the lightest sits a little under the floor tiles, so the room reads first. */
  blockLight: '#bcc1c8',
  blockDark: '#858b95',
  /** Crates: a rich gold. */
  cube: '#f0a91e',
  /** A runner whose run is over fades toward this grey. */
  dormant: '#9aa0aa',
  /** The soft round shadow under every runner. */
  blobShadow: '#1a1712',
  /** The runners: a saturated glossy blue, deeper than the UI accent, since lit glossy color washes out on the bright floor. */
  runner: '#2a87ff',
  /** The crowd runs a little greyer than the champion, so the eye finds the champion first. */
  crowdGrey: '#9aa3b2',
  /** Ghosts of past champions: a cool slate for the oldest, nearly white blue for the newest. */
  ghostOld: '#8d9dbd',
  ghostNew: '#dcecff',
  /** The ring at the champion's feet: a pale, bright blue. */
  championRing: '#7fc0ff',
  /** Movers are machinery, not crates: a dark graphite body with hazard amber stripes and frame, and amber on their rail. */
  moverBody: '#2c3139',
  moverTrim: '#ffb020',
  moverRail: '#30353d',
  /** Spikes: bright steel points on a near black base with a red trim that reads as danger at a glance. */
  spikeSteel: '#eef1f5',
  spikeBase: '#24272d',
  spikeTrim: '#d8333f',
  /** The start zone and the finish gate. */
  startPad: '#4c9aff',
  finishGlow: '#eafff4',
  checkerDark: '#1d2129',
  checkerLight: '#f4f6f9',
  /** Sensor hits by kind: walls and crates a deep blue, spikes red, movers amber. Deep enough to read on the pale floor. */
  senseSolid: '#2f7bff',
  senseSpikes: '#ff4d5e',
  senseMover: '#ffb020',
  /** Sensor beams, the goal arrow and the path hint. */
  senseBeam: '#5aa2ff',
  goalArrow: '#3dd68c',
  pathHint: '#4c9aff',
} as const;
