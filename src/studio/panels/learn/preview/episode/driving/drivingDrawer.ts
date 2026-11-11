import type { DrivingPreviewScene } from '@/engine/driving/preview/scene';
import type { EpisodePreview } from '@/engine/lessons/preview/types';
import { frameAt, secondsAt } from '../../playback';
import { fitView, px, py, type View } from '../../view';
import { drawEnd, drawRays, drawTrail, EPISODE_COLORS } from '../drawEpisode';
import type { PreviewDrawer } from '../drawers';
import { poseBetween, poseFields, previewBounds } from '../pose';
import { drawCity } from './drawCity';
import { drawLife } from './drawLife';

/** The SUV's footprint, m, and the smallest it is drawn, px. */
const SUV_LENGTH = 4.9;
const SUV_WIDTH = 2;
const MIN_SUV_PX = 10;

/**
 * The still city drawn once per canvas size and preview, then copied onto
 * every frame: a city map is a few hundred shapes, and the playback loop
 * should only pay for what moves.
 */
interface CityLayer {
  preview: EpisodePreview;
  w: number;
  h: number;
  dpr: number;
  canvas: HTMLCanvasElement;
}
let layer: CityLayer | null = null;

function cityLayer(p: EpisodePreview, scene: DrivingPreviewScene, v: View, w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (layer && layer.preview === p && layer.w === w && layer.h === h && layer.dpr === dpr) return layer.canvas;
  const canvas = layer?.canvas ?? document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  drawCity(g, v, scene);
  layer = { preview: p, w, h, dpr, canvas };
  return canvas;
}

function drawSuv(g: CanvasRenderingContext2D, v: View, x: number, y: number, heading: number): void {
  const length = Math.max(SUV_LENGTH * v.scale, MIN_SUV_PX);
  const width = Math.max(SUV_WIDTH * v.scale, MIN_SUV_PX * 0.42);
  g.save();
  g.translate(px(v, x), py(v, y));
  // The screen's y runs down, so a heading measured counterclockwise turns the other way on the canvas.
  g.rotate(-heading);
  g.fillStyle = EPISODE_COLORS.agent;
  g.strokeStyle = EPISODE_COLORS.edge;
  g.lineWidth = 1.5;
  g.beginPath();
  g.roundRect(-length / 2, -width / 2, length, width, Math.min(3, width / 3));
  g.fill();
  g.stroke();
  // A light bar across the nose, so the way it faces reads at a glance.
  g.fillStyle = EPISODE_COLORS.nose;
  g.fillRect(length / 2 - Math.max(1.5, 0.35 * v.scale) - 1, -width * 0.36, Math.max(1.5, 0.35 * v.scale), width * 0.72);
  g.restore();
}

/**
 * The Driving lesson and test run preview: a top down map of the streets
 * around the route, with the lights, the traffic and the people as they
 * were on each tick, and the SUV with its trail and lidar beams.
 */
function draw(g: CanvasRenderingContext2D, w: number, h: number, p: EpisodePreview, pos: number): void {
  g.clearRect(0, 0, w, h);
  const scene = p.scene as DrivingPreviewScene | null;
  const f = poseFields(p.fields);
  if (!f || !scene) return;
  const v = fitView(previewBounds(p, f), w, h, 2, true);
  const city = cityLayer(p, scene, v, w, h);
  if (city) g.drawImage(city, 0, 0, w, h);
  else drawCity(g, v, scene);
  if (p.ticks === 0) return;
  const { i, j, f: t } = frameAt(pos, p.ticks);
  drawLife(g, v, scene, p, i, j, t);
  const at = poseBetween(p, f, pos);
  drawTrail(g, v, p, f, at);
  drawRays(g, v, p, at);
  drawSuv(g, v, at.x, at.y, at.heading);
  drawEnd(g, v, p, at);
}

/** Time, speed, the reward so far and, at the end, why the trip stopped. */
function readout(p: EpisodePreview, pos: number): string {
  if (p.ticks === 0) return '';
  const { i } = frameAt(pos, p.ticks);
  const speed = p.frames[i * p.fields.length + p.fields.indexOf('speed')] ?? 0;
  const end = i === p.ticks - 1 ? `, stopped: ${p.stopReason}` : '';
  return `${secondsAt(pos, p.ticks, p.tickHz).toFixed(1)} s, ${speed.toFixed(1)} m/s, reward ${p.rewards[i].toFixed(2)}${end}`;
}

export const DRIVING_DRAWER: PreviewDrawer = {
  draw,
  readout,
  caption: 'The trip a check drives, with a fixed test driver. Lights, cars and people move as they did.',
  label: 'Top view of the test drive: the streets, the route, the lights, other cars, people and the SUV with its lidar',
};
