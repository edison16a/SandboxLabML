import type { DrivingPreviewScene } from '@/engine/driving/preview/scene';
import { px, py, type View } from '../../view';

/** The city in the app's dark greys: asphalt a step above the frame, sidewalks above that, buildings set back in the middle. */
export const CITY_COLORS = {
  asphalt: '#1b212d',
  sidewalk: '#262e3c',
  building: '#141924',
  buildingEdge: '#2b3342',
  centerLine: 'rgba(245, 196, 81, 0.32)',
  zebra: 'rgba(231, 235, 243, 0.18)',
  route: 'rgba(76, 154, 255, 0.16)',
  stopLine: 'rgba(231, 235, 243, 0.7)',
  destination: '#3dd68c',
  start: '#5d6779',
};

/** Sidewalk width inside each block's curb, m, and the zebra band along the street, m. */
const SIDEWALK = 3.5;
const ZEBRA_DEPTH = 3;
const LANE = 3.5;

/** The street grid: asphalt over the whole extent, then every block's sidewalk and building on top. */
function drawBlocks(g: CanvasRenderingContext2D, v: View, s: DrivingPreviewScene): void {
  const e = s.extent;
  // Past the outer streets the city goes on: a sidewalk all round, then buildings to the edge of the frame.
  g.fillStyle = CITY_COLORS.building;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.fillStyle = CITY_COLORS.sidewalk;
  g.fillRect(px(v, e.minX - SIDEWALK), py(v, e.maxY + SIDEWALK), (e.maxX - e.minX + 2 * SIDEWALK) * v.scale, (e.maxY - e.minY + 2 * SIDEWALK) * v.scale);
  g.fillStyle = CITY_COLORS.asphalt;
  g.fillRect(px(v, e.minX), py(v, e.maxY), (e.maxX - e.minX) * v.scale, (e.maxY - e.minY) * v.scale);
  for (let k = 0; k < s.blocks.length; k += 4) {
    const [x0, y0, x1, y1] = [s.blocks[k], s.blocks[k + 1], s.blocks[k + 2], s.blocks[k + 3]];
    g.fillStyle = CITY_COLORS.sidewalk;
    g.beginPath();
    g.roundRect(px(v, x0), py(v, y1), (x1 - x0) * v.scale, (y1 - y0) * v.scale, 4 * v.scale);
    g.fill();
    const inset = SIDEWALK;
    g.fillStyle = CITY_COLORS.building;
    g.strokeStyle = CITY_COLORS.buildingEdge;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(px(v, x0 + inset), py(v, y1 - inset), (x1 - x0 - 2 * inset) * v.scale, (y1 - y0 - 2 * inset) * v.scale, 2 * v.scale);
    g.fill();
    g.stroke();
  }
}

/** A dashed center line down every street, stopping short of each junction box. */
function drawCenterLines(g: CanvasRenderingContext2D, v: View, s: DrivingPreviewScene): void {
  const box = s.roadHalf + 1;
  g.strokeStyle = CITY_COLORS.centerLine;
  g.lineWidth = Math.max(1, 0.15 * v.scale);
  g.setLineDash([Math.max(2, 3 * v.scale), Math.max(2, 3 * v.scale)]);
  g.beginPath();
  for (const x of s.xs) {
    for (let j = 0; j + 1 < s.ys.length; j++) {
      g.moveTo(px(v, x), py(v, s.ys[j] + box));
      g.lineTo(px(v, x), py(v, s.ys[j + 1] - box));
    }
  }
  for (const y of s.ys) {
    for (let i = 0; i + 1 < s.xs.length; i++) {
      g.moveTo(px(v, s.xs[i] + box), py(v, y));
      g.lineTo(px(v, s.xs[i + 1] - box), py(v, y));
    }
  }
  g.stroke();
  g.setLineDash([]);
}

/** Zebra crossings as a few stripes across the street, on every signalized arm. */
function drawCrossings(g: CanvasRenderingContext2D, v: View, s: DrivingPreviewScene): void {
  g.fillStyle = CITY_COLORS.zebra;
  const stripes = 5;
  const span = 2 * s.roadHalf;
  for (let k = 0; k < s.crosswalks.length; k += 3) {
    const x = s.crosswalks[k];
    const y = s.crosswalks[k + 1];
    // An east or west arm runs along a horizontal street, so its zebra spans the street from south to north.
    const across = s.crosswalks[k + 2] % 2 === 0;
    for (let n = 0; n < stripes; n++) {
      const t = -span / 2 + ((n + 0.5) * span) / stripes;
      const w = (span / stripes) * 0.55;
      if (across) g.fillRect(px(v, x - ZEBRA_DEPTH / 2), py(v, y + t + w / 2), ZEBRA_DEPTH * v.scale, w * v.scale);
      else g.fillRect(px(v, x + t - w / 2), py(v, y + ZEBRA_DEPTH / 2), w * v.scale, ZEBRA_DEPTH * v.scale);
    }
  }
}

/** The route as a soft lane wide ribbon, with its stop lines and the destination zone. */
function drawRoute(g: CanvasRenderingContext2D, v: View, s: DrivingPreviewScene): void {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = CITY_COLORS.route;
  g.lineWidth = Math.max(3, LANE * v.scale);
  g.beginPath();
  for (let k = 0; k < s.route.length; k += 2) g.lineTo(px(v, s.route[k]), py(v, s.route[k + 1]));
  g.stroke();
  g.strokeStyle = CITY_COLORS.stopLine;
  g.lineWidth = Math.max(1.5, 0.4 * v.scale);
  g.lineCap = 'butt';
  for (let k = 0; k < s.stops.length; k += 3) {
    const [x, y, h] = [s.stops[k], s.stops[k + 1], s.stops[k + 2]];
    const nx = -Math.sin(h) * (LANE / 2);
    const ny = Math.cos(h) * (LANE / 2);
    g.beginPath();
    g.moveTo(px(v, x - nx), py(v, y - ny));
    g.lineTo(px(v, x + nx), py(v, y + ny));
    g.stroke();
  }
  const d = s.destination;
  g.fillStyle = 'rgba(61, 214, 140, 0.14)';
  g.strokeStyle = CITY_COLORS.destination;
  g.lineWidth = 1.5;
  g.save();
  g.translate(px(v, d.x), py(v, d.y));
  g.rotate(-d.heading);
  g.beginPath();
  g.roundRect(-7 * v.scale, (-LANE / 2) * v.scale, 14 * v.scale, LANE * v.scale, 2);
  g.fill();
  g.stroke();
  g.restore();
  g.strokeStyle = CITY_COLORS.start;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(px(v, s.start.x), py(v, s.start.y), Math.max(4, 1.2 * v.scale), 0, 2 * Math.PI);
  g.stroke();
}

/** Everything that never moves: streets, blocks, crossings and the route. */
export function drawCity(g: CanvasRenderingContext2D, v: View, s: DrivingPreviewScene): void {
  drawBlocks(g, v, s);
  drawCenterLines(g, v, s);
  drawCrossings(g, v, s);
  drawRoute(g, v, s);
}
