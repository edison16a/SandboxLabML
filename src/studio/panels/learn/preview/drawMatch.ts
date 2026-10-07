import { arenaWallRects } from '@/engine/hideseek/layouts/geometry';
import { getLayout } from '@/engine/hideseek/layouts/presets';
import { BOX_COUNT, BOX_KINDS, boxSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import {
  AGENT_FLAGS,
  AGENT_X,
  AGENT_YAW,
  AGENT_Z,
  BOX_LOCK,
  FLAG_FROZEN,
  FLAG_SEEING,
  HIDESEEK_SNAPSHOT,
  LOCK_FREE,
  LOCK_SEEKERS,
  SNAPSHOT_PHASE,
  SNAPSHOT_SEEN,
  snapshotAgentAt,
  snapshotBoxAt,
} from '@/engine/hideseek/snapshot';
import type { MatchPreview } from '@/engine/lessons/preview/types';
import { frameAt, lerp, lerpAngle, secondsAt } from './playback';
import { fitView, px, py, type View } from './view';

/** Test matches play under the default rules, so the room and bodies are drawn to them. */
const P = DEFAULT_HIDESEEK_PHYSICS;
const STRIDE = HIDESEEK_SNAPSHOT.stride;

/** The 3D scene's colors on a dark floor: team blue and red, gold crates, a jade ramp, and a locked box edged in its owner's color like its 3D braces. */
const C = {
  floor: '#151a24',
  grid: '#1b212d',
  wall: '#8a94a7',
  cube: '#bf9a3e',
  plank: '#c28d45',
  ramp: '#5f9e7f',
  hider: '#4c9aff',
  seeker: '#ff5f6d',
  cone: 'rgba(255, 95, 109, 0.09)',
  face: '#f2f4f8',
};

/** A pose between two frames, read from x, z and yaw stored in a row at offsets `a` and `b`. */
function pose(f: Float32Array, a: number, b: number, t: number): { x: number; z: number; yaw: number } {
  return { x: lerp(f[a + AGENT_X], f[b + AGENT_X], t), z: lerp(f[a + AGENT_Z], f[b + AGENT_Z], t), yaw: lerpAngle(f[a + AGENT_YAW], f[b + AGENT_YAW], t) };
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

/** A box turned to its yaw. Its local x runs along its length; a locked box keeps its fill and gets an edge in its owner team's color. */
function drawBox(g: CanvasRenderingContext2D, v: View, index: number, at: { x: number; z: number; yaw: number }, lock: number): void {
  const size = boxSize(P, index);
  const l = size.length * v.scale;
  const w = size.width * v.scale;
  g.save();
  g.translate(px(v, at.x), py(v, at.z));
  // Yaw turns counterclockwise seen from above, and the canvas turns clockwise, hence the minus.
  g.rotate(-at.yaw);
  g.fillStyle = C[BOX_KINDS[index]];
  g.fillRect(-l / 2, -w / 2, l, w);
  if (lock !== LOCK_FREE) {
    g.strokeStyle = lock === LOCK_SEEKERS ? C.seeker : C.hider;
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
    const o = snapshotBoxAt(k);
    drawBox(g, v, k, pose(fr, A + o, B + o, f), fr[A + o + BOX_LOCK]);
  }
  const ho = snapshotAgentAt(0);
  const so = snapshotAgentAt(1);
  const hider = pose(fr, A + ho, B + ho, f);
  const seeker = pose(fr, A + so, B + so, f);
  const seekerFlags = fr[A + so + AGENT_FLAGS];
  if (fr[A + SNAPSHOT_PHASE] !== 1) drawCone(g, v, seeker);
  if (seekerFlags & FLAG_SEEING) {
    g.strokeStyle = C.seeker;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(px(v, seeker.x), py(v, seeker.z));
    g.lineTo(px(v, hider.x), py(v, hider.z));
    g.stroke();
  }
  drawAgent(g, v, hider, C.hider, (fr[A + ho + AGENT_FLAGS] & FLAG_FROZEN) !== 0);
  drawAgent(g, v, seeker, C.seeker, (seekerFlags & FLAG_FROZEN) !== 0);
}

/** The line under the match: time, the phase, whether the hider is seen and both teams' totals. */
export function matchReadout(p: MatchPreview, pos: number): string {
  if (p.ticks === 0) return '';
  const { i } = frameAt(pos, p.ticks);
  const A = i * STRIDE;
  const phase = p.frames[A + SNAPSHOT_PHASE] === 1 ? 'prep' : p.frames[A + SNAPSHOT_SEEN] === 1 ? 'hider seen' : 'hider hidden';
  return `${secondsAt(pos, p.ticks).toFixed(1)} s, ${phase}, hider ${p.rewards[2 * i].toFixed(1)}, seeker ${p.rewards[2 * i + 1].toFixed(1)}`;
}
