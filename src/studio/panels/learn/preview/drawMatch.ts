import { arenaWallRects } from '@/engine/hideseek/layouts/geometry';
import { getLayout } from '@/engine/hideseek/layouts/presets';
import { BOX_COUNT, boxSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { FLAG_FROZEN, FLAG_SEEING, HIDESEEK_SNAPSHOT, SNAPSHOT_AGENTS_AT, SNAPSHOT_BOXES_AT, SNAPSHOT_ENTRY } from '@/engine/hideseek/snapshot';
import type { MatchPreview } from '@/engine/lessons/preview/types';
import { frameAt, lerp, lerpAngle, secondsAt } from './playback';
import { fitView, px, py, type View } from './view';

/** Test matches play under the default rules, so the room and bodies are drawn to them. */
const P = DEFAULT_HIDESEEK_PHYSICS;
const STRIDE = HIDESEEK_SNAPSHOT.stride;

/** The 3D scene's colors on a dark floor: team blue and red, gold crates, and a locked crate edged in hider blue like its 3D braces. */
const C = {
  floor: '#151a24',
  grid: '#1b212d',
  wall: '#8a94a7',
  cube: '#bf9a3e',
  plank: '#c28d45',
  locked: '#4c9aff',
  hider: '#4c9aff',
  seeker: '#ff5f6d',
  cone: 'rgba(255, 95, 109, 0.09)',
  face: '#f2f4f8',
};

/** A pose between two frames, read from x, z and yaw stored in a row at offsets `a` and `b`. */
function pose(f: Float32Array, a: number, b: number, t: number): { x: number; z: number; yaw: number } {
  return { x: lerp(f[a], f[b], t), z: lerp(f[a + 1], f[b + 1], t), yaw: lerpAngle(f[a + 2], f[b + 2], t) };
}

function drawRoom(g: CanvasRenderingContext2D, v: View, p: MatchPreview): void {
  const half = P.arena.size / 2;
  g.fillStyle = C.floor;
  g.fillRect(px(v, -half), py(v, -half), P.arena.size * v.scale, P.arena.size * v.scale);
  g.strokeStyle = C.grid;
  g.lineWidth = 1;
  g.beginPath();
  for (let k = -half + 5; k < half; k += 5) {
    g.moveTo(px(v, k), py(v, -half));
    g.lineTo(px(v, k), py(v, half));
    g.moveTo(px(v, -half), py(v, k));
    g.lineTo(px(v, half), py(v, k));
  }
  g.stroke();
  g.fillStyle = C.wall;
  for (const r of arenaWallRects(getLayout(p.layout), P)) g.fillRect(px(v, r.x - r.hx), py(v, r.z - r.hz), 2 * r.hx * v.scale, 2 * r.hz * v.scale);
}

/** A box turned to its yaw. Its local x runs along its length; a locked box keeps its fill and gets a blue edge. */
function drawBox(g: CanvasRenderingContext2D, v: View, index: number, at: { x: number; z: number; yaw: number }, locked: boolean): void {
  const size = boxSize(P, index);
  const l = size.length * v.scale;
  const w = size.width * v.scale;
  g.save();
  g.translate(px(v, at.x), py(v, at.z));
  // Yaw turns counterclockwise seen from above, and the canvas turns clockwise, hence the minus.
  g.rotate(-at.yaw);
  g.fillStyle = index < 2 ? C.cube : C.plank;
  g.fillRect(-l / 2, -w / 2, l, w);
  if (locked) {
    g.strokeStyle = C.locked;
    g.lineWidth = 2;
    g.strokeRect(-l / 2, -w / 2, l, w);
  }
  g.restore();
}

/** The seeker's field of view as a faint wedge, kept inside the room. Walls are not cut out, so the sight line says who is really seen. */
function drawCone(g: CanvasRenderingContext2D, v: View, s: { x: number; z: number; yaw: number }): void {
  const half = P.arena.size / 2;
  g.save();
  g.beginPath();
  g.rect(px(v, -half), py(v, -half), P.arena.size * v.scale, P.arena.size * v.scale);
  g.clip();
  g.fillStyle = C.cone;
  g.beginPath();
  g.moveTo(px(v, s.x), py(v, s.z));
  g.arc(px(v, s.x), py(v, s.z), P.vision.range * v.scale, -s.yaw - P.vision.fov / 2, -s.yaw + P.vision.fov / 2);
  g.closePath();
  g.fill();
  g.restore();
}

/** A player as a disc in its team color with a white line where it faces, faded while frozen. */
function drawAgent(g: CanvasRenderingContext2D, v: View, at: { x: number; z: number; yaw: number }, color: string, frozen: boolean): void {
  const r = Math.max(P.agent.radius * v.scale, 4);
  const x = px(v, at.x);
  const y = py(v, at.z);
  g.globalAlpha = frozen ? 0.5 : 1;
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, 2 * Math.PI);
  g.fill();
  g.strokeStyle = C.face;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.cos(-at.yaw) * r * 1.5, y + Math.sin(-at.yaw) * r * 1.5);
  g.stroke();
  g.globalAlpha = 1;
}

/**
 * Draws the test match at a playhead, in ticks: walls, boxes (locked ones
 * edged in blue), the seeker's view cone once it is loose, a red sight line
 * while it sees the hider, and both players.
 */
export function drawMatch(g: CanvasRenderingContext2D, w: number, h: number, p: MatchPreview, pos: number): void {
  const half = P.arena.size / 2 + P.arena.outerWallThickness;
  const v = fitView({ minX: -half, minY: -half, maxX: half, maxY: half }, w, h, 0.3, false);
  g.clearRect(0, 0, w, h);
  drawRoom(g, v, p);
  if (p.ticks === 0) return;
  const { i, j, f } = frameAt(pos, p.ticks);
  const fr = p.frames;
  const A = i * STRIDE;
  const B = j * STRIDE;
  for (let k = 0; k < BOX_COUNT; k++) {
    const o = SNAPSHOT_BOXES_AT + k * SNAPSHOT_ENTRY;
    drawBox(g, v, k, pose(fr, A + o, B + o, f), fr[A + o + 3] === 1);
  }
  const hider = pose(fr, A + SNAPSHOT_AGENTS_AT, B + SNAPSHOT_AGENTS_AT, f);
  const so = SNAPSHOT_AGENTS_AT + SNAPSHOT_ENTRY;
  const seeker = pose(fr, A + so, B + so, f);
  const seekerFlags = fr[A + so + 3];
  if (fr[A + 1] !== 1) drawCone(g, v, seeker);
  if (seekerFlags & FLAG_SEEING) {
    g.strokeStyle = C.seeker;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(px(v, seeker.x), py(v, seeker.z));
    g.lineTo(px(v, hider.x), py(v, hider.z));
    g.stroke();
  }
  drawAgent(g, v, hider, C.hider, (fr[A + SNAPSHOT_AGENTS_AT + 3] & FLAG_FROZEN) !== 0);
  drawAgent(g, v, seeker, C.seeker, (seekerFlags & FLAG_FROZEN) !== 0);
}

/** The line under the match: time, the phase, whether the hider is seen and both teams' totals. */
export function matchReadout(p: MatchPreview, pos: number): string {
  if (p.ticks === 0) return '';
  const { i } = frameAt(pos, p.ticks);
  const A = i * STRIDE;
  const phase = p.frames[A + 1] === 1 ? 'prep' : p.frames[A + 2] === 1 ? 'hider seen' : 'hider hidden';
  return `${secondsAt(pos, p.ticks).toFixed(1)} s, ${phase}, hider ${p.rewards[2 * i].toFixed(1)}, seeker ${p.rewards[2 * i + 1].toFixed(1)}`;
}
