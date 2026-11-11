import { HS_COLORS } from '@/render/hideseek/colors';

/**
 * Colors of the Navigation scene. The room, the walls, the city and the
 * crates are the Hide and Seek look, taken from its palette so the two
 * never drift apart; the rest is what this game adds. Plain hex strings,
 * so 2D code can share them without loading three.js.
 */
export const NAV_COLORS = {
  ...HS_COLORS,
  /** The runners: the hider blue, every one of them. */
  runner: HS_COLORS.hiderBody,
  /** The crowd runs a little greyer than the champion, so the eye finds the champion first. */
  crowdGrey: '#9aa3b2',
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
  /** The start pad and the finish gate. */
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
