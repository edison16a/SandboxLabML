import * as THREE from 'three';
import { WHEEL } from '../dimensions';
import { lathe, type Profile } from './lathe';
import { PartBin, type Detail, type Slot } from './parts';
import { spokes } from './spokes';

const HALF = WHEEL.width / 2;

/**
 * A low profile tire: square shoulders, a thin sidewall and three grooves
 * in the tread, which catch a line of light as the wheel turns.
 */
function tire(detail: Detail): THREE.BufferGeometry {
  const r = WHEEL.radius;
  const bead = WHEEL.rim + 0.004;
  const arc = detail.brakes ? 3 : 1;
  const side = (s: 1 | -1): Profile => {
    const pts: Profile = [[bead, s * (HALF - 0.012)], [bead + 0.03, s * (HALF + 0.002)], [r - 0.03, s * (HALF + 0.003)]];
    for (let i = 1; i <= arc; i++) {
      const a = (i / arc) * (Math.PI / 2);
      pts.push([r - 0.022 + Math.sin(a) * 0.022, s * (HALF - 0.022 + Math.cos(a) * 0.025)]);
    }
    return pts;
  };
  const inner = side(-1);
  const outer = side(1).reverse();
  if (!detail.brakes) return lathe([[...inner, ...outer]], detail.wheel);
  // Tread split by grooves; each run is smooth, the groove walls are crisp.
  const grooves = [-0.06, 0, 0.06];
  const runs: Profile[] = [];
  let run: Profile = [...inner];
  for (const g of grooves) {
    run.push([r, g - 0.007]);
    runs.push(run);
    runs.push([[r, g - 0.007], [r - 0.008, g - 0.006], [r - 0.008, g + 0.006], [r, g + 0.007]]);
    run = [[r, g + 0.007]];
  }
  runs.push([...run, ...outer]);
  return lathe(runs, detail.wheel);
}

/** The rim barrel seen behind the spokes, and the polished lip at its outer edge. */
function barrel(detail: Detail): { barrel: THREE.BufferGeometry; lip: THREE.BufferGeometry } {
  const rim = WHEEL.rim;
  const inside: Profile = detail.brakes
    ? [[rim + 0.006, -HALF + 0.004], [rim - 0.012, -HALF + 0.01], [rim - 0.018, -HALF + 0.05], [rim - 0.018, HALF - 0.04], [rim - 0.008, HALF - 0.014]]
    : [[rim - 0.012, -HALF + 0.01], [rim - 0.012, HALF - 0.004]];
  const lip: Profile = [[rim - 0.008, HALF - 0.014], [rim - 0.002, HALF - 0.004], [rim + 0.006, HALF + 0.0], [rim + 0.008, HALF - 0.012]];
  // The barrel is walked outside to inside, so its visible face points at the axle.
  return { barrel: lathe([inside.reverse()], detail.wheel), lip: lathe([lip.reverse()], detail.wheel) };
}

/**
 * The carbon ceramic disc and its bell. The disc sits well inboard, so the
 * spokes frame it the way a real forged wheel shows off its brakes.
 */
function brakeDisc(detail: Detail): { disc: THREE.BufferGeometry; bell: THREE.BufferGeometry } {
  const z0 = -0.035;
  const z1 = -0.003;
  const ro = 0.208;
  const ri = 0.105;
  const disc = lathe(
    [
      [[ro, z1], [ri, z1]],
      [[ri, z1], [ri, z0]],
      [[ri, z0], [ro, z0]],
      [[ro, z0], [ro, z1]],
    ],
    detail.wheel,
  );
  const bell = lathe(
    [
      [[ri + 0.006, z1], [0.098, z1 + 0.012], [0.09, 0.05]],
      [[0.09, 0.05], [0.04, 0.05]],
    ],
    Math.max(16, detail.wheel / 2),
  );
  return { disc, bell };
}

/**
 * A fixed caliper hugging the top rear of the disc. It steers with the
 * wheel but does not spin, so the hero car keeps it in a separate mesh.
 */
export function caliper(detail: Detail): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const a0 = 0.32 * Math.PI;
  const a1 = 0.68 * Math.PI;
  const steps = detail.fine ? 10 : 4;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const p = new THREE.Vector2(Math.cos(a) * 0.238, Math.sin(a) * 0.238);
    if (i === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  }
  for (let i = steps; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / steps;
    shape.lineTo(Math.cos(a) * 0.168, Math.sin(a) * 0.168);
  }
  const bevel = detail.fine ? 0.008 : 0;
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.07 - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 });
  // Rotate so it sits behind the axle, across the top of the disc.
  g.translate(0, 0, -0.054 + bevel);
  g.rotateZ(0.12 * Math.PI);
  return g;
}

/**
 * The spinning half of a wheel, by slot, centered on its axle with the
 * outer face toward +Z. Wheels on the left are drawn mirrored.
 */
export function buildWheel(detail: Detail): Map<Slot, THREE.BufferGeometry> {
  const bin = new PartBin();
  const b = barrel(detail);
  bin.add('tire', tire(detail));
  bin.add('rim', b.barrel, spokes(detail));
  if (detail.brakes) {
    bin.add('metal', b.lip);
    const d = brakeDisc(detail);
    bin.add('disc', d.disc);
    bin.add('rim', d.bell);
    const hub = new THREE.CylinderGeometry(0.058, 0.066, 0.02, 24).rotateX(Math.PI / 2).translate(0, 0, HALF - 0.08);
    const nut = new THREE.CylinderGeometry(0.036, 0.04, 0.03, 12).rotateX(Math.PI / 2).translate(0, 0, HALF - 0.062);
    bin.add('rim', hub);
    bin.add('gold', nut);
  }
  return bin.build();
}
