import { FOLLOW, followAim, followAzimuth, followSide } from '@/render/navigation/camera/shots';
import { stepSpring, type Spring } from '@/render/shared/interpolate';
import type { PaneView } from '../stage/paneView';

/**
 * Px of shot per meter of floor in the free part of the shot, so the
 * runner keeps one size whatever the pane's shape: close enough that
 * its face reads, the lab's follow view. The span it gives stays between
 * a tight 6 m and a 12 m that shows a stretch of the course.
 */
export const PX_PER_M = 72;
const SPAN_MIN = 6;
const SPAN_MAX = 12;

/** How far the camera stands from its aim, m, so the free part of the shot shows a span of floor at PX_PER_M, across and deep. */
export function followDistance(pane: PaneView, fovDeg: number): number {
  const { w, h } = pane.shot;
  const zw = pane.zoneW * w;
  const zh = pane.zoneH * h;
  const span = Math.min(SPAN_MAX, Math.max(SPAN_MIN, Math.min(zw, zh) / PX_PER_M));
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  const aspect = w / Math.max(1, h);
  return Math.max(span / (2 * tan * aspect * pane.zoneW), (span * Math.sin(FOLLOW.elevation)) / (2 * tan * pane.zoneH));
}

/**
 * The hero's follow camera: the lab's follow view of the runner (a drone
 * behind it and off to the side of the wall it is near, looking down the
 * course), on springs of its own. The aim trails the runner and the side
 * swings over slowly, so no step of the runner jolts the picture.
 */
export class HeroFollow {
  readonly aim = { x: { value: 0, velocity: 0 } as Spring, z: { value: 0, velocity: 0 } as Spring };
  private readonly azimuth: Spring = { value: followAzimuth(1), velocity: 0 };
  private readonly at = { x: 0, z: 0 };
  private side = 1;
  private epoch = Number.NaN;
  /** Where the camera stands this frame. */
  readonly pos = { x: 0, y: 0, z: 0 };

  /** Steps the shot for a runner at (x, z) in a room of half size (hx, hz). A new episode puts it straight in place. */
  update(x: number, z: number, hx: number, hz: number, epoch: number, distance: number, dt: number): void {
    followAim(x, z, hx, hz, this.at);
    if (epoch !== this.epoch) {
      this.epoch = epoch;
      this.side = followSide(z, z >= 0 ? 1 : -1);
      this.aim.x.value = this.at.x;
      this.aim.z.value = this.at.z;
      this.aim.x.velocity = this.aim.z.velocity = 0;
      this.azimuth.value = followAzimuth(this.side);
      this.azimuth.velocity = 0;
    }
    const ax = stepSpring(this.aim.x, this.at.x, FOLLOW.stiffness, dt);
    const az = stepSpring(this.aim.z, this.at.z, FOLLOW.stiffness, dt);
    this.side = followSide(z, this.side);
    const azimuth = stepSpring(this.azimuth, followAzimuth(this.side), FOLLOW.swing, dt);
    const flat = Math.cos(FOLLOW.elevation) * distance;
    this.pos.x = ax + Math.sin(azimuth) * flat;
    this.pos.y = FOLLOW.height + Math.sin(FOLLOW.elevation) * distance;
    this.pos.z = az + Math.cos(azimuth) * flat;
  }
}
