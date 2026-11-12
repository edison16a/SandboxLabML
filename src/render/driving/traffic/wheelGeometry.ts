import * as THREE from 'three';
import { gridGeometry, merge, polygonGeometry, type Vec3 } from '../suv/geometry/grid';
import { lathe } from '../suv/geometry/lathe';
import { bakeLook, type Look } from './looks';

/** Tire width, m. */
const WIDTH = 0.225;
/** Share of the tire's radius the rim fills: a slim, dark sidewall band round a large wheel. */
const RIM_SHARE = 0.7;
/** How far the dark recess behind the spokes sits below the outer face, m. */
const DEEP = 0.05;

/** Depth of the wheel's dish below the outer face at radius r, m: shallow at the lip, deepest at the hub. */
const dish = (r: number, rim: number) => 0.006 + 0.022 * (1 - r / rim);

/** A ring of n points at radius r and axial offset z, counterclockwise seen from outside. */
const ring = (r: number, z: number, n: number): Vec3[] => Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2), z]);

function baked(parts: Array<[THREE.BufferGeometry, Look]>): THREE.BufferGeometry {
  const ready = parts.map(([g, look]) => bakeLook(g, [look]));
  const merged = merge(ready);
  ready.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * A traffic car wheel centered on its axle, outer face toward +Z: a black
 * tread with rounded shoulders, a slim satin sidewall, a bright lip round
 * a silver rim, and spokes so a rolling wheel visibly turns. Ten slim
 * spokes stand over a real recess on the finer tiers; Low paints five dark
 * openings on a dish and skips what hides behind the liner. Light enough
 * to draw a few hundred at once.
 */
export function trafficWheelGeometry(radius: number, segments: number): THREE.BufferGeometry {
  const h = WIDTH / 2;
  const rim = radius * RIM_SHARE;
  const lip = rim + 0.012;
  const hubR = rim * 0.3;
  const fine = segments >= 16;
  const tread = lathe([[[radius - 0.02, -h], [radius, -h + 0.045], [radius, h - 0.045], [radius - 0.02, h]]], segments);
  const wall = lathe([fine ? [[radius - 0.02, h], [radius - 0.045, h + 0.008], [lip, h + 0.002]] : [[radius - 0.02, h], [lip, h + 0.002]]], segments);
  const ringLip = lathe([[[lip, h + 0.002], [rim - 0.006, h - dish(rim - 0.006, rim)]]], segments);
  const parts: Array<[THREE.BufferGeometry, Look]> = [[tread, 'tire'], [wall, 'wall'], [ringLip, 'lip']];
  // A silver hub disc and a small dark center cap close the middle flat, so no pinhole shows at the pole.
  const hubZ = h - dish(hubR, rim) + 0.0015;
  parts.push([polygonGeometry(ring(hubR, hubZ, 10), [0, 0, 1]), 'rim']);
  parts.push([polygonGeometry(ring(hubR * 0.5, hubZ + 0.002, 8), [0, 0, 1]), 'hub']);
  if (!fine) {
    // Low: a solid dish with five dark openings painted just proud of it.
    parts.push([lathe([[[rim - 0.006, h - dish(rim - 0.006, rim)], [hubR, h - dish(hubR, rim)]]], segments), 'rim']);
    for (let k = 0; k < 5; k++) parts.push([paintedGap(rim, h, (k / 5) * Math.PI * 2), 'gap']);
    return baked(parts);
  }
  // The inboard sidewall, the barrel inside the lip and the dark recess the spokes stand over.
  parts.push([lathe([[[rim, -h + 0.01], [radius - 0.02, -h]]], segments), 'wall']);
  parts.push([lathe([[[rim - 0.004, h - 0.008], [rim - 0.008, h - DEEP]]], segments), 'hub']);
  parts.push([polygonGeometry(ring(rim - 0.008, h - DEEP, segments), [0, 0, 1]), 'gap']);
  for (let k = 0; k < 10; k++) parts.push([spoke(rim, hubR, h, (k / 10) * Math.PI * 2), 'rim']);
  return baked(parts);
}

/**
 * One slim spoke from under the hub cap out under the lip: a top with a
 * soft ridge down its middle and two side walls dropping into the recess,
 * so the openings between spokes read as real depth as the wheel turns.
 */
function spoke(rim: number, hubR: number, h: number, a: number): THREE.BufferGeometry {
  const r0 = hubR * 0.9;
  const r1 = rim;
  const at = (r: number, half: number, lift: number): Vec3 => {
    const t = a + half / r;
    return [r * Math.cos(t), r * Math.sin(t), h - 0.004 - dish(r, rim) + lift];
  };
  // Wider out at the rim than at the hub, as cast spokes are.
  const halfAt = (r: number) => 0.012 + (0.01 * (r - r0)) / (r1 - r0);
  const top = gridGeometry([r0, r1].map((r) => [at(r, -halfAt(r), 0), at(r, 0, 0.002), at(r, halfAt(r), 0)]));
  const sides = [-1, 1].map((side) => {
    const edge = (r: number, down: number): Vec3 => {
      const p = at(r, side * halfAt(r), 0);
      return [p[0], p[1], p[2] - down];
    };
    const rows = [r0, r1].map((r) => [edge(r, 0), edge(r, 0.03)]);
    // Columns run down the wall; on the counterclockwise side that order faces the wall outward.
    return gridGeometry(side > 0 ? rows : rows.map((row) => [...row].reverse()));
  });
  const g = merge([top, ...sides], []);
  [top, ...sides].forEach((p) => p.dispose());
  return g;
}

/**
 * One dark opening between two of Low's five spokes, lying just proud of
 * the dish: wide under the rim and narrowing toward the hub, so the
 * spokes between keep an even width.
 */
function paintedGap(rim: number, h: number, a: number): THREE.BufferGeometry {
  const r0 = rim * 0.36;
  const r1 = rim * 0.9;
  const half = (Math.PI / 5) * 0.62;
  const rows: Vec3[][] = [r0, r1].map((r, i) => {
    const w = half * (0.45 + 0.55 * i);
    return [-w, 0, w].map((d) => [r * Math.cos(a + d), r * Math.sin(a + d), h - dish(r, rim) + 0.0025] as Vec3);
  });
  return gridGeometry(rows);
}
