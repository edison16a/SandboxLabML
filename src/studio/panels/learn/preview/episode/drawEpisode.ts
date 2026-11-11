import type { EpisodePreview } from '@/engine/lessons/preview/types';
import { frameAt } from '../playback';
import { fitView, px, py, type View } from '../view';
import { poseAt, poseBetween, poseFields, previewBounds, type Pose, type PoseFields } from './pose';

/** Theme colors, matching the racing drive: surface greys, the agent in the accent blue. */
export const EPISODE_COLORS = {
  grid: '#1a202b',
  gridMajor: '#232a37',
  path: 'rgba(76, 154, 255, 0.16)',
  trail: 'rgba(76, 154, 255, 0.6)',
  agent: '#4c9aff',
  nose: '#e7ebf3',
  ray: 'rgba(231, 235, 243, 0.2)',
  hit: 'rgba(231, 235, 243, 0.7)',
  start: '#5d6779',
  good: '#3ecf8e',
  bad: '#ff5f5f',
  edge: '#0f131a',
};

/** Smallest the agent is drawn, px, so it stays visible on a big map in a small preview. */
const MIN_AGENT_PX = 13;

/** A faint ground grid, every 1, 5 or 10 m depending on the zoom, so distances read at a glance. */
export function drawGrid(g: CanvasRenderingContext2D, v: View, w: number, h: number): void {
  const step = v.scale > 24 ? 1 : v.scale > 6 ? 5 : 10;
  const x0 = Math.floor(-v.ox / v.scale / step) * step;
  const x1 = (w - v.ox) / v.scale;
  g.lineWidth = 1;
  for (let x = x0; x <= x1; x += step) {
    g.strokeStyle = Math.round(x / step) % 5 === 0 ? EPISODE_COLORS.gridMajor : EPISODE_COLORS.grid;
    g.beginPath();
    g.moveTo(Math.round(px(v, x)) + 0.5, 0);
    g.lineTo(Math.round(px(v, x)) + 0.5, h);
    g.stroke();
  }
  const top = v.flip ? v.oy / v.scale : -v.oy / v.scale;
  const bottom = v.flip ? (v.oy - h) / v.scale : (h - v.oy) / v.scale;
  for (let y = Math.floor(Math.min(top, bottom) / step) * step; y <= Math.max(top, bottom); y += step) {
    g.strokeStyle = Math.round(y / step) % 5 === 0 ? EPISODE_COLORS.gridMajor : EPISODE_COLORS.grid;
    g.beginPath();
    g.moveTo(0, Math.round(py(v, y)) + 0.5);
    g.lineTo(w, Math.round(py(v, y)) + 0.5);
    g.stroke();
  }
}

/** The whole path faintly, then the part already walked or driven over it, up to the agent. */
export function drawTrail(g: CanvasRenderingContext2D, v: View, p: EpisodePreview, f: PoseFields, at: Pose & { i: number }): void {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const [color, end] of [[EPISODE_COLORS.path, p.ticks - 1] as const, [EPISODE_COLORS.trail, at.i] as const]) {
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.beginPath();
    for (let k = 0; k <= end; k++) {
      const q = poseAt(p, f, k);
      g.lineTo(px(v, q.x), py(v, q.y));
    }
    if (end === at.i) g.lineTo(px(v, at.x), py(v, at.y));
    g.stroke();
  }
}

/** Each ray from the agent to where it reaches, with a dot where it hit something. */
export function drawRays(g: CanvasRenderingContext2D, v: View, p: EpisodePreview, at: Pose & { i: number }): void {
  const n = p.rays.length;
  if (n === 0) return;
  g.lineWidth = 1;
  for (let k = 0; k < n; k++) {
    const reach = p.reach[at.i * n + k];
    const a = at.heading + p.rays[k].angle;
    const len = reach * p.rays[k].maxLength;
    // On screen a facing turns clockwise for both ground conventions (see drawAgent), so the ray is drawn in screen space.
    const hx = px(v, at.x) + Math.cos(a) * len * v.scale;
    const hy = py(v, at.y) - Math.sin(a) * len * v.scale;
    g.strokeStyle = EPISODE_COLORS.ray;
    g.beginPath();
    g.moveTo(px(v, at.x), py(v, at.y));
    g.lineTo(hx, hy);
    g.stroke();
    if (reach < 0.999) {
      g.fillStyle = EPISODE_COLORS.hit;
      g.fillRect(hx - 1.5, hy - 1.5, 3, 3);
    }
  }
}

/** The agent as a rounded arrow pointing where it faces, or a dot when the env has no facing. */
export function drawAgent(g: CanvasRenderingContext2D, v: View, at: Pose, facing: boolean, size = 1.6): void {
  const r = Math.max((size * v.scale) / 2, MIN_AGENT_PX / 2);
  g.save();
  g.translate(px(v, at.x), py(v, at.y));
  g.fillStyle = EPISODE_COLORS.agent;
  if (!facing) {
    g.beginPath();
    g.arc(0, 0, r, 0, 2 * Math.PI);
    g.fill();
    g.restore();
    return;
  }
  // The screen's y runs down, so a facing measured counterclockwise turns the other way on the canvas.
  g.rotate(-at.heading);
  g.beginPath();
  g.moveTo(r * 1.35, 0);
  g.lineTo(-r * 0.9, r * 0.95);
  g.quadraticCurveTo(-r * 0.45, 0, -r * 0.9, -r * 0.95);
  g.closePath();
  g.fill();
  // A dark edge keeps the arrow apart from the trail under it.
  g.strokeStyle = EPISODE_COLORS.edge;
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
}

/** A ring where the episode ended, green for a finish and red for a crash or a fall. */
export function drawEnd(g: CanvasRenderingContext2D, v: View, p: EpisodePreview, at: Pose & { i: number }): void {
  if (at.i !== p.ticks - 1 || p.stopReason === 'time') return;
  const good = /reach|finish|arriv|goal|there/i.test(p.stopReason);
  g.strokeStyle = good ? EPISODE_COLORS.good : EPISODE_COLORS.bad;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(px(v, at.x), py(v, at.y), Math.max(12, 2 * v.scale), 0, 2 * Math.PI);
  g.stroke();
}

/** The reward so far as a line over the whole episode, with the playhead. For envs without a position to draw. */
function drawRewardCurve(g: CanvasRenderingContext2D, w: number, h: number, p: EpisodePreview, pos: number): void {
  const pad = 16;
  // Room at the bottom for the readout line.
  const bottom = 32;
  let lo = 0;
  let hi = 0;
  for (const r of p.rewards) {
    lo = Math.min(lo, r);
    hi = Math.max(hi, r);
  }
  const span = hi - lo || 1;
  const x = (k: number) => pad + ((w - 2 * pad) * k) / Math.max(1, p.ticks - 1);
  const y = (r: number) => h - bottom - ((h - pad - bottom) * (r - lo)) / span;
  g.strokeStyle = EPISODE_COLORS.gridMajor;
  g.beginPath();
  g.moveTo(pad, y(0));
  g.lineTo(w - pad, y(0));
  g.stroke();
  g.strokeStyle = EPISODE_COLORS.trail;
  g.lineWidth = 2;
  g.beginPath();
  for (let k = 0; k < p.ticks; k++) g.lineTo(x(k), y(p.rewards[k]));
  g.stroke();
  const { i } = frameAt(pos, p.ticks);
  g.fillStyle = EPISODE_COLORS.agent;
  g.beginPath();
  g.arc(x(i), y(p.rewards[i]), 4, 0, 2 * Math.PI);
  g.fill();
}

/**
 * The preview of an env without a drawer of its own: a top view of the
 * agent's trail, rays and facing on a ground grid, from its snapshot's
 * position fields. An env without position fields gets its reward curve.
 */
export function drawEpisode(g: CanvasRenderingContext2D, w: number, h: number, p: EpisodePreview, pos: number): void {
  g.clearRect(0, 0, w, h);
  if (p.ticks === 0) return;
  const f = poseFields(p.fields);
  if (!f) return drawRewardCurve(g, w, h, p, pos);
  const v = fitView(previewBounds(p, f), w, h, 1, f.flip);
  drawGrid(g, v, w, h);
  const start = poseAt(p, f, 0);
  g.strokeStyle = EPISODE_COLORS.start;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(px(v, start.x), py(v, start.y), 5, 0, 2 * Math.PI);
  g.stroke();
  const at = poseBetween(p, f, pos);
  drawTrail(g, v, p, f, at);
  drawRays(g, v, p, at);
  drawAgent(g, v, at, f.heading >= 0);
  drawEnd(g, v, p, at);
}
