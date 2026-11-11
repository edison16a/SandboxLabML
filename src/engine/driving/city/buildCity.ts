import { Rng } from '../../core/rng';
import { SIGNAL_CYCLE } from '../signals/plan';
import { ROAD_HALF, type Dir } from './dimensions';
import { buildConnectors, buildLanes } from './lanes';
import { buildCrosswalks, buildRings } from './sidewalks';
import type { City, CityBlock, CityNode, CitySpec } from './types';

/** Street line positions from block sizes, centered on the origin. */
function lines(sizes: number[]): Float64Array {
  const total = sizes.reduce((a, b) => a + b, 0);
  const out = new Float64Array(sizes.length + 1);
  out[0] = -total / 2;
  for (let i = 0; i < sizes.length; i++) out[i + 1] = out[i] + sizes[i];
  return out;
}

function buildNodes(xs: Float64Array, ys: Float64Array): CityNode[] {
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  const nodes: CityNode[] = [];
  let signals = 0;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const arms: [boolean, boolean, boolean, boolean] = [i < nx, j < ny, i > 0, j > 0];
      const armCount = arms.filter(Boolean).length;
      // Crossings and T junctions get signals; the four outer corners are plain bends.
      nodes.push({ id: nodes.length, i, j, x: xs[i], y: ys[j], arms, armCount, signal: armCount >= 3 ? signals++ : -1 });
    }
  }
  return nodes;
}

function buildBlocks(xs: Float64Array, ys: Float64Array): CityBlock[] {
  const blocks: CityBlock[] = [];
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      blocks.push({ i, j, x0: xs[i] + ROAD_HALF, x1: xs[i + 1] - ROAD_HALF, y0: ys[j] + ROAD_HALF, y1: ys[j + 1] - ROAD_HALF });
    }
  }
  return blocks;
}

/**
 * Builds the whole city from its spec: the street grid, every lane and
 * turn, the signals with their seeded offsets, the sidewalks and the zebra
 * crossings. Pure and deterministic, so a worker, the renderer and a test
 * all get the same city from the same spec.
 */
export function buildCity(spec: CitySpec): City {
  const xs = lines(spec.columns);
  const ys = lines(spec.rows);
  const nx = xs.length - 1;
  const nodes = buildNodes(xs, ys);
  const blocks = buildBlocks(xs, ys);
  const bounds = { minX: xs[0] - ROAD_HALF, maxX: xs[nx] + ROAD_HALF, minY: ys[0] - ROAD_HALF, maxY: ys[ys.length - 1] + ROAD_HALF };
  const rings = buildRings(blocks, bounds);
  const crosswalks = buildCrosswalks(nodes, rings);
  const byArm = new Map<number, number>();
  for (const c of crosswalks) byArm.set(c.node * 4 + c.arm, c.id);
  const lanes = buildLanes(spec, nodes, nx);
  const connectors = buildConnectors(nodes, lanes, (node: number, arm: Dir) => byArm.get(node * 4 + arm) ?? -1);
  const signals = nodes.filter((n) => n.signal >= 0).map((n) => n.id);
  const rng = new Rng(spec.seed ^ 0x5161);
  const signalOffsets = Float64Array.from(signals, () => rng.range(0, SIGNAL_CYCLE));
  return { spec, xs, ys, nodes, elements: [...lanes, ...connectors], laneCount: lanes.length, signals, signalOffsets, blocks, rings, crosswalks, bounds };
}

const cache = new Map<string, City>();

/** buildCity, kept per spec so a generation, its ghosts and the renderer share one city. */
export function cityFor(spec: CitySpec): City {
  const key = JSON.stringify(spec);
  let city = cache.get(key);
  if (!city) {
    city = buildCity(spec);
    if (cache.size > 8) cache.clear();
    cache.set(key, city);
  }
  return city;
}
