import type { PaneView } from '../stage/paneView';

/** Elevation of the shot: low enough to see faces and the sides of crates, steep enough to see over most walls. */
export const HERO_ELEVATION = (44 * Math.PI) / 180;
/**
 * CSS px per meter of floor in the free part of the pane, so the players
 * keep one size on screen whatever the pane's shape: close enough that
 * eyes and faces read. The span it gives stays between a tight 6.5 m and
 * a 16 m that holds most of the room.
 */
export const PX_PER_M = 62;
const SPAN_MIN = 6.5;
const SPAN_MAX = 16;

/** What the hero camera frames: how far it stands, and how much floor the free part of the pane shows across and deep, m. */
export interface HeroFrame {
  distance: number;
  across: number;
  deep: number;
}

/**
 * Sizes the shot to the free part of the pane: a span of floor at
 * PX_PER_M, fit both across and deep (the floor's depth foreshortened by
 * the elevation), and the floor that part then really shows.
 */
export function heroFrame(pane: PaneView, fovDeg: number, elevation: number, out: HeroFrame): HeroFrame {
  const { w, h } = pane.rect;
  const zw = pane.zoneW * w;
  const zh = pane.zoneH * h;
  const span = Math.min(SPAN_MAX, Math.max(SPAN_MIN, Math.min(zw, zh) / PX_PER_M));
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  const aspect = w / Math.max(1, h);
  out.distance = Math.max(span / (2 * tan * aspect * pane.zoneW), (span * Math.sin(elevation)) / (2 * tan * pane.zoneH));
  const pxPerM = zw / (2 * out.distance * tan * aspect * pane.zoneW);
  out.across = zw / pxPerM;
  out.deep = zh / pxPerM / Math.sin(elevation);
  return out;
}

/**
 * How far from the middle of the shot the followed player may drift, as
 * shares of half the shot: across, up the screen and down it. Down is
 * tighter, since the brain card sits in the pane's bottom corner.
 */
const KEEP = { across: 0.6, up: 0.6, down: 0.4 };

/**
 * Where to aim so the shot shows the room rather than the city round it,
 * without losing the player at (x, z): the floor the shot covers
 * (`across` by `deep`, turned `azimuth` rad) stays inside the room's half
 * size `half` where it can, and centers on the room where it cannot, but
 * the player always stays inside the KEEP part of the shot. Writes the aim
 * to `out`.
 */
export function clampAim(x: number, z: number, azimuth: number, f: HeroFrame, half: number, out: { x: number; z: number }): { x: number; z: number } {
  const ca = Math.cos(azimuth);
  const sa = Math.sin(azimuth);
  // Half the covered floor along the world axes, for a rectangle turned by the azimuth.
  const ex = (Math.abs(ca) * f.across + Math.abs(sa) * f.deep) / 2;
  const ez = (Math.abs(sa) * f.across + Math.abs(ca) * f.deep) / 2;
  const rx = Math.max(0, half - ex);
  const rz = Math.max(0, half - ez);
  const ax = Math.max(-rx, Math.min(rx, x));
  const az = Math.max(-rz, Math.min(rz, z));
  // Across the screen (u) and toward the camera (v). An aim nearer the camera than the player (v > 0) shows the player above the middle.
  const du = (ax - x) * ca - (az - z) * sa;
  const dv = (ax - x) * sa + (az - z) * ca;
  const mu = (KEEP.across * f.across) / 2;
  const u = Math.max(-mu, Math.min(mu, du));
  const v = Math.max((-KEEP.down * f.deep) / 2, Math.min((KEEP.up * f.deep) / 2, dv));
  out.x = x + u * ca + v * sa;
  out.z = z - u * sa + v * ca;
  return out;
}
