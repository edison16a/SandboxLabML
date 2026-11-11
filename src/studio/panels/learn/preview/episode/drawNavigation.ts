import { FINISH_INSET, OUTER_WALL, START_ZONE, type CourseSpec } from '@/engine/navigation/course/types';
import type { NavigationPreviewScene } from '@/engine/navigation/pipeline/lessons';
import { WORLD_HEADER } from '@/engine/navigation/snapshot';
import type { EpisodePreview } from '@/engine/lessons/preview/types';
import { NAV_COLORS } from '@/render/navigation/palette';
import { frameAt, lerp } from '../playback';
import { fitView, px, py, type View } from '../view';
import { drawAgent, drawEnd, drawRays, drawTrail } from './drawEpisode';
import { poseBetween, poseFields } from './pose';

/** The course in the Studio's dark theme: a dark floor, light walls, and the 3D scene's crate, spike and mover colors. */
const C = {
  floor: '#1b212c',
  tile: 'rgba(255, 255, 255, 0.035)',
  wall: '#c9ced6',
  block: NAV_COLORS.cube,
  blockEdge: '#7d5f3c',
  spikes: NAV_COLORS.spikeTrim,
  spikeDot: 'rgba(255, 235, 238, 0.75)',
  mover: NAV_COLORS.moverTrim,
  rail: 'rgba(255, 176, 32, 0.45)',
  start: 'rgba(76, 154, 255, 0.14)',
  startLine: 'rgba(76, 154, 255, 0.7)',
  checkerDark: '#0f131a',
  checkerLight: '#e8ecf2',
};

function rect(g: CanvasRenderingContext2D, v: View, x: number, z: number, hx: number, hz: number): void {
  g.fillRect(px(v, x - hx), py(v, z - hz), 2 * hx * v.scale, 2 * hz * v.scale);
}

/** The room: floor tiles every 2 m, the start zone, the start line and a checkered finish line. */
function drawRoom(g: CanvasRenderingContext2D, v: View, spec: CourseSpec): void {
  const hl = spec.length / 2;
  const hw = spec.width / 2;
  g.fillStyle = C.wall;
  rect(g, v, 0, 0, hl + OUTER_WALL, hw + OUTER_WALL);
  g.fillStyle = C.floor;
  rect(g, v, 0, 0, hl, hw);
  g.fillStyle = C.tile;
  for (let x = -hl; x < hl; x += 2) for (let z = -hw; z < hw; z += 2) if ((Math.round(x + hl) / 2 + Math.round(z + hw) / 2) % 2 === 0) rect(g, v, x + 1, z + 1, 1, 1);
  g.fillStyle = C.start;
  rect(g, v, -hl + START_ZONE / 2, 0, START_ZONE / 2, hw);
  g.fillStyle = C.startLine;
  rect(g, v, -hl + START_ZONE, 0, 0.06, hw);
  const fx = hl - FINISH_INSET;
  const cell = 0.5;
  for (let k = 0; k * cell < spec.width; k++) {
    for (let col = 0; col < 2; col++) {
      g.fillStyle = (k + col) % 2 === 0 ? C.checkerLight : C.checkerDark;
      rect(g, v, fx + (col - 0.5) * cell, -hw + (k + 0.5) * cell, cell / 2, Math.min(cell, spec.width - k * cell) / 2);
    }
  }
}

/** Walls, crates and spike pads, which never move, and each mover's rail. */
function drawStill(g: CanvasRenderingContext2D, v: View, spec: CourseSpec): void {
  for (const o of spec.obstacles) {
    if (o.kind === 'mover') {
      g.strokeStyle = C.rail;
      g.lineWidth = Math.max(1, 0.12 * v.scale);
      g.setLineDash([0.4 * v.scale, 0.3 * v.scale]);
      g.beginPath();
      g.moveTo(px(v, o.ax), py(v, o.az));
      g.lineTo(px(v, o.bx), py(v, o.bz));
      g.stroke();
      g.setLineDash([]);
    } else if (o.kind === 'spikes') {
      g.fillStyle = C.spikes;
      rect(g, v, o.x, o.z, o.hx, o.hz);
      // A dot every 40 cm reads as points at any zoom.
      g.fillStyle = C.spikeDot;
      const step = 0.4;
      const d = Math.max(1, 0.06 * v.scale);
      for (let x = o.x - o.hx + step / 2; x < o.x + o.hx; x += step) for (let z = o.z - o.hz + step / 2; z < o.z + o.hz; z += step) g.fillRect(px(v, x) - d / 2, py(v, z) - d / 2, d, d);
    } else {
      g.fillStyle = o.kind === 'wall' ? C.wall : C.block;
      rect(g, v, o.x, o.z, o.hx, o.hz);
      if (o.kind === 'block') {
        g.strokeStyle = C.blockEdge;
        g.lineWidth = 1;
        g.strokeRect(px(v, o.x - o.hx) + 0.5, py(v, o.z - o.hz) + 0.5, 2 * o.hx * v.scale - 1, 2 * o.hz * v.scale - 1);
      }
    }
  }
}

/** Each mover where the world block put it at the playhead, between two recorded ticks. */
function drawMovers(g: CanvasRenderingContext2D, v: View, spec: CourseSpec, p: EpisodePreview, pos: number): void {
  const movers = spec.obstacles.filter((o) => o.kind === 'mover');
  if (!movers.length || p.worldFloats === 0) return;
  const { i, j, f } = frameAt(pos, p.ticks);
  const a = i * p.worldFloats + WORLD_HEADER;
  const b = j * p.worldFloats + WORLD_HEADER;
  g.fillStyle = C.mover;
  movers.forEach((m, k) => {
    if (m.kind !== 'mover') return;
    rect(g, v, lerp(p.world[a + 2 * k], p.world[b + 2 * k], f), lerp(p.world[a + 2 * k + 1], p.world[b + 2 * k + 1], f), m.hx, m.hz);
  });
}

/**
 * The Navigation lesson preview: the course from above (start on the
 * left, finish on the right) with its crates, walls, spikes and moving
 * crates, then the runner's trail, its rays and the runner on top.
 */
export function drawNavigation(g: CanvasRenderingContext2D, w: number, h: number, p: EpisodePreview, pos: number): void {
  g.clearRect(0, 0, w, h);
  const f = poseFields(p.fields);
  const scene = p.scene as NavigationPreviewScene | null;
  if (p.ticks === 0 || !f || !scene?.spec || !p.bounds) return;
  const v = fitView(p.bounds, w, h, 0.6, false);
  drawRoom(g, v, scene.spec);
  drawStill(g, v, scene.spec);
  drawMovers(g, v, scene.spec, p, pos);
  const at = poseBetween(p, f, pos);
  drawTrail(g, v, p, f, at);
  drawRays(g, v, p, at);
  drawAgent(g, v, at, true, 0.8);
  drawEnd(g, v, p, at);
}
