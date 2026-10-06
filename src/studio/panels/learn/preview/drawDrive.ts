import type { DrivePreview } from '@/engine/lessons/preview/types';
import { frameAt, lerp, lerpAngle, secondsAt } from './playback';
import { fitView, px, py, type View } from './view';

/** Theme colors: the road in surface greys, the car in the accent blue. */
const C = {
  road: '#1b212d',
  edge: '#2f3848',
  start: '#5d6779',
  trail: 'rgba(76, 154, 255, 0.45)',
  car: '#4c9aff',
  ray: 'rgba(231, 235, 243, 0.22)',
  hit: 'rgba(231, 235, 243, 0.65)',
  crash: '#ff5f5f',
};

/** Car size, m, and the smallest it is drawn, px, so it stays visible on a big track in a small preview. */
const CAR_LENGTH = 4.6;
const CAR_WIDTH = 2;
const MIN_CAR_PX = 9;

function line(g: CanvasRenderingContext2D, v: View, pts: Float32Array, close: boolean): void {
  g.beginPath();
  for (let k = 0; k < pts.length; k += 2) g.lineTo(px(v, pts[k]), py(v, pts[k + 1]));
  if (close) g.closePath();
  g.stroke();
}

/** The road as a wide dark band with thin edges, and the start line across it. */
function drawRoad(g: CanvasRenderingContext2D, v: View, p: DrivePreview): void {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = C.road;
  g.lineWidth = Math.max(2, p.width * v.scale);
  line(g, v, p.center, true);
  g.strokeStyle = C.edge;
  g.lineWidth = 1;
  line(g, v, p.left, true);
  line(g, v, p.right, true);
  g.strokeStyle = C.start;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(px(v, p.left[0]), py(v, p.left[1]));
  g.lineTo(px(v, p.right[0]), py(v, p.right[1]));
  g.stroke();
}

/** The trail so far, up to the car's current spot between frames. */
function drawTrail(g: CanvasRenderingContext2D, v: View, poses: Float32Array, i: number, x: number, y: number): void {
  g.strokeStyle = C.trail;
  g.lineWidth = 2;
  g.beginPath();
  for (let k = 0; k <= i; k++) g.lineTo(px(v, poses[3 * k]), py(v, poses[3 * k + 1]));
  g.lineTo(px(v, x), py(v, y));
  g.stroke();
}

/** Ray hit points move with the car, so they are interpolated the same way. */
function drawRays(g: CanvasRenderingContext2D, v: View, p: DrivePreview, i: number, j: number, f: number, x: number, y: number): void {
  const n = p.rayCount;
  g.lineWidth = 1;
  for (let k = 0; k < n; k++) {
    const a = (i * n + k) * 2;
    const b = (j * n + k) * 2;
    const hx = px(v, lerp(p.rays[a], p.rays[b], f));
    const hy = py(v, lerp(p.rays[a + 1], p.rays[b + 1], f));
    g.strokeStyle = C.ray;
    g.beginPath();
    g.moveTo(px(v, x), py(v, y));
    g.lineTo(hx, hy);
    g.stroke();
    g.fillStyle = C.hit;
    g.fillRect(hx - 1.5, hy - 1.5, 3, 3);
  }
}

function drawCar(g: CanvasRenderingContext2D, v: View, x: number, y: number, heading: number): void {
  const length = Math.max(CAR_LENGTH * v.scale, MIN_CAR_PX);
  const width = Math.max(CAR_WIDTH * v.scale, MIN_CAR_PX * 0.45);
  g.save();
  g.translate(px(v, x), py(v, y));
  // The screen's y runs down, so a heading measured counterclockwise turns the other way on the canvas.
  g.rotate(-heading);
  g.fillStyle = C.car;
  g.beginPath();
  g.roundRect(-length / 2, -width / 2, length, width, 2);
  g.fill();
  g.fillStyle = '#e7ebf3';
  g.fillRect(length / 2 - 2.5, -width / 4, 2, width / 2);
  g.restore();
}

/**
 * Draws the test drive at a playhead, in ticks: the road, the trail so
 * far, the rays and the car. A crash gets a red ring once the replay
 * reaches it.
 */
export function drawDrive(g: CanvasRenderingContext2D, w: number, h: number, p: DrivePreview, pos: number): void {
  const v = fitView(p.bounds, w, h, p.width / 2 + 3, true);
  g.clearRect(0, 0, w, h);
  drawRoad(g, v, p);
  if (p.ticks === 0) return;
  const { i, j, f } = frameAt(pos, p.ticks);
  const x = lerp(p.poses[3 * i], p.poses[3 * j], f);
  const y = lerp(p.poses[3 * i + 1], p.poses[3 * j + 1], f);
  const heading = lerpAngle(p.poses[3 * i + 2], p.poses[3 * j + 2], f);
  drawTrail(g, v, p.poses, i, x, y);
  drawRays(g, v, p, i, j, f, x, y);
  drawCar(g, v, x, y, heading);
  if (p.stopReason === 'crash' && i === p.ticks - 1) {
    g.strokeStyle = C.crash;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(px(v, x), py(v, y), Math.max(10, CAR_LENGTH * v.scale), 0, 2 * Math.PI);
    g.stroke();
  }
}

/** The line under the drive: time, the reward so far and, at the end, why it stopped. */
export function driveReadout(p: DrivePreview, pos: number): string {
  if (p.ticks === 0) return '';
  const { i } = frameAt(pos, p.ticks);
  const end = i === p.ticks - 1 ? `, stopped: ${p.stopReason}` : '';
  return `${secondsAt(pos, p.ticks).toFixed(1)} s, reward ${p.rewards[i].toFixed(2)}${end}`;
}
