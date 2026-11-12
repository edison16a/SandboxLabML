import * as THREE from 'three';
import { gridGeometry, merge, polygonGeometry, type Vec3 } from '../../suv/geometry/grid';
import { bakeLook, LAMP } from '../looks';
import type { CarShape } from '../shape/types';
import type { Projector } from './project';

/**
 * The right door mirror (the drawn half is the right): a smooth rounded
 * pod on a short stalk, its inner face just inside the door on every tier
 * so it never floats. Gloss black, like the trim.
 */
export function doorMirror(s: CarShape, proj: Projector, fine: boolean): THREE.BufferGeometry {
  const { x, y, out } = s.mirror;
  const at = proj.hit('side', x, y);
  const z = at ? at.p[2] : s.width / 2 - 0.08;
  // A rounded box rather than a ball (each coordinate pushed out toward the cube), its back
  // pressed nearly flat where the glass would be: a D in plan. It keeps the ball's own normals,
  // bent by the same squash, so its few facets shade as one smooth shell instead of a die.
  const head = new THREE.SphereGeometry(1, fine ? 9 : 6, fine ? 5 : 3);
  const p = head.attributes.position;
  const n = head.attributes.normal;
  const round = (c: number) => Math.sign(c) * Math.pow(Math.abs(c), 0.7);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const back = p.getX(i) < 0 ? 0.45 : 1;
    p.setXYZ(i, round(p.getX(i)) * back, round(p.getY(i)), round(p.getZ(i)));
    v.set(n.getX(i) / back, n.getY(i), n.getZ(i)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  head.scale(0.075, 0.058, out * 0.5).translate(x - 0.02, y + 0.035, z + out * 0.45);
  const stalk = new THREE.SphereGeometry(1, 4, 2).scale(0.05, 0.02, out * 0.35).translate(x + 0.01, y - 0.005, z + out * 0.2);
  const parts = [bakeLook(head, ['trim']), bakeLook(stalk, ['trim'])];
  const g = merge(parts);
  parts.forEach((q) => q.dispose());
  return g;
}

/** A rounded rectangle in the x-y plane, counterclockwise from the bottom middle. */
function rounded(w: number, h: number, r: number, steps: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const corners: Array<[number, number, number]> = [
    [w / 2 - r, -h / 2 + r, -Math.PI / 2],
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (Math.PI / 2) * (i / steps);
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return out;
}

/**
 * The cab's roof sign: a slim rounded box across the roof on a black
 * foot, its front and back faces lit. It stays the same in every frame,
 * so the glow is baked as a steady lamp.
 */
export function roofSign(s: CarShape, proj: Projector): THREE.BufferGeometry {
  const x = -0.12;
  const base = proj.hit('top', x, 0)?.p[1] ?? s.length / 3;
  const depth = 0.17;
  const tall = 0.11;
  const half = 0.31;
  const y0 = base + 0.035 + tall / 2;
  const ring = rounded(depth, tall, 0.035, 2);
  // Rows run from the right end (+z) to the left and columns round the outline, which faces the skin out.
  const shell = gridGeometry([half, -half].map((z) => [...ring, ring[0]].map(([a, b]) => [x + a, y0 + b, z] as Vec3)));
  const caps = [1, -1].map((side) => polygonGeometry(ring.map(([a, b]) => [x + a, y0 + b, side * half] as Vec3), [0, 0, side]));
  const faces = [1, -1].map((side) => {
    const q = new THREE.PlaneGeometry(2 * half - 0.05, tall - 0.035).rotateY((side * Math.PI) / 2).translate(x + side * (depth / 2 + 0.002), y0, 0);
    return bakeLook(q, ['sign'], LAMP.sign);
  });
  const foot = new THREE.BoxGeometry(depth * 0.7, 0.035, 2 * half * 0.85).translate(x, base + 0.017, 0);
  // The foot's underside sits on the roof where nothing can see it; a box keeps it as indices 18 to 23.
  foot.setIndex(Array.from(foot.index?.array ?? []).filter((_, i) => i < 18 || i >= 24));
  const parts = [bakeLook(shell, ['plate']), ...caps.map((c) => bakeLook(c, ['plate'])), ...faces, bakeLook(foot, ['trim'])];
  const g = merge(parts);
  parts.forEach((p) => p.dispose());
  return g;
}
