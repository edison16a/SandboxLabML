import * as THREE from 'three';
import type { Track } from '@/engine/racing/track/types';
import type { GhostTelemetry } from '@/workers/replay/ghostPlayer';
import { ghostColor } from './palette';

/**
 * Builds the brake map: for every meter of road, the newest generation whose
 * champion braked there. Drawn as a strip on the run-off, it shows braking
 * points sliding later around each corner as generations improve.
 */
export function brakeMapGeometry(track: Track, telemetry: GhostTelemetry[]): THREE.BufferGeometry | null {
  if (!telemetry.length) return null;
  const n = track.count;
  const newest = new Float32Array(n).fill(-1);
  telemetry.forEach((t, gi) => {
    for (let k = 0; k < t.brake.length; k++) {
      if (t.brake[k] < 0.15 || t.distance[k] < 0) continue;
      const s = t.distance[k] % track.length;
      const i = Math.floor(s / track.spacing) % n;
      newest[i] = Math.max(newest[i], gi);
    }
  });
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const inner = -(track.halfWidth + 0.35);
  const outer = -(track.halfWidth + 1.25);
  const last = Math.max(1, telemetry.length - 1);
  const side = (i: number, off: number): [number, number] => [track.cx[i] - track.ty[i] * off, -(track.cy[i] + track.tx[i] * off)];
  for (let i = 0; i < n; i++) {
    if (newest[i] < 0) continue;
    const j = (i + 1) % n;
    ghostColor(newest[i] / last, c);
    const [ax, az] = side(i, inner);
    const [bx, bz] = side(i, outer);
    const [cx2, cz] = side(j, inner);
    const [dx, dz] = side(j, outer);
    const y = 0.03;
    pos.push(ax, y, az, cx2, y, cz, bx, y, bz, bx, y, bz, cx2, y, cz, dx, y, dz);
    for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
