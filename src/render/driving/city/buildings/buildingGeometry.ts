import * as THREE from 'three';
import { isOnRoad } from '@/engine/driving/city/surface';
import type { City } from '@/engine/driving/city/types';
import { CURB_HEIGHT } from '../ground/slabs';
import type { BuildingSpec } from './layout';

/** Facade codes in aFacade.w: what a face is. */
export const FACE_WALL = 0;
export const FACE_SHOPS = 1;
export const FACE_PLAIN = 2;
export const FACE_ROOF = 3;

/**
 * Collects building faces with what the facade shader needs per vertex:
 * uv (meters along the wall, meters above the street), aFacade (style,
 * seed, wall length, face kind) and aTop (the wall's top, m). All buildings of a city merge into one
 * geometry and one draw call.
 */
class Faces {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];
  readonly facade: number[] = [];
  readonly top: number[] = [];
  readonly index: number[] = [];

  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3, uvs: number[], f: [number, number, number, number], top: number): void {
    const k = this.pos.length / 3;
    for (const p of [a, b, c, d]) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.facade.push(...f);
      this.top.push(top);
    }
    this.uv.push(...uvs);
    this.index.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aFacade', new THREE.Float32BufferAttribute(this.facade, 4));
    g.setAttribute('aTop', new THREE.Float32BufferAttribute(this.top, 1));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}

const v = (x: number, y: number, h: number) => new THREE.Vector3(x, h, -y);

/** Does the wall with outward normal (nx, ny) at (x, y) face a street? Shops only go where people walk past. */
function facesStreet(city: City, x: number, y: number, nx: number, ny: number): boolean {
  return isOnRoad(city, x + nx * 7, y + ny * 7) || isOnRoad(city, x + nx * 10, y + ny * 10);
}

/**
 * A box from h0 to h1 over a footprint: four walls and, when `roof`, a lid.
 * Walls run counterclockwise seen from above so their normals face out.
 */
function box(f: Faces, city: City, s: BuildingSpec, x0: number, x1: number, y0: number, y1: number, h0: number, h1: number, kind: number, roof: boolean): void {
  const corners: Array<[number, number]> = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = (by - ay) / len;
    const ny = -(bx - ax) / len;
    const face = kind === FACE_WALL && s.shops && h0 <= CURB_HEIGHT + 0.01 && facesStreet(city, (ax + bx) / 2, (ay + by) / 2, nx, ny) ? FACE_SHOPS : kind;
    const n = new THREE.Vector3(nx, 0, -ny);
    f.quad(v(ax, ay, h0), v(bx, by, h0), v(bx, by, h1), v(ax, ay, h1), n, [0, h0, len, h0, len, h1, 0, h1], [s.style, s.seed, len, face], h1);
  }
  if (roof) f.quad(v(x0, y0, h1), v(x1, y0, h1), v(x1, y1, h1), v(x0, y1, h1), new THREE.Vector3(0, 1, 0), [x0, y0, x1, y0, x1, y1, x0, y1], [s.style, s.seed, x1 - x0, FACE_ROOF], h1);
}

/** A low wall round the edge of a roof at height h: four thin boxes inside the footprint. */
function parapet(f: Faces, city: City, s: BuildingSpec, x0: number, x1: number, y0: number, y1: number, h: number): void {
  const t = 0.32;
  const top = h + 0.95;
  box(f, city, s, x0, x1, y0, y0 + t, h, top, FACE_PLAIN, true);
  box(f, city, s, x0, x1, y1 - t, y1, h, top, FACE_PLAIN, true);
  box(f, city, s, x0, x0 + t, y0 + t, y1 - t, h, top, FACE_PLAIN, true);
  box(f, city, s, x1 - t, x1, y0 + t, y1 - t, h, top, FACE_PLAIN, true);
}

/**
 * Every building as faces for the facade shader. A tall building on a
 * podium steps back above it; near buildings get a parapet round the roof.
 */
export function buildingGeometry(city: City, buildings: BuildingSpec[]): THREE.BufferGeometry {
  const f = new Faces();
  const base = CURB_HEIGHT;
  for (const s of buildings) {
    if (s.podium > 0) {
      box(f, city, s, s.x0, s.x1, s.y0, s.y1, base, s.podium, FACE_WALL, true);
      const inset = Math.min(5, (s.x1 - s.x0) / 4, (s.y1 - s.y0) / 4);
      box(f, city, s, s.x0 + inset, s.x1 - inset, s.y0 + inset, s.y1 - inset, s.podium, s.height, FACE_WALL, true);
      parapet(f, city, s, s.x0 + inset, s.x1 - inset, s.y0 + inset, s.y1 - inset, s.height);
    } else {
      box(f, city, s, s.x0, s.x1, s.y0, s.y1, s.far ? 0 : base, s.height, FACE_WALL, true);
      if (!s.far) parapet(f, city, s, s.x0, s.x1, s.y0, s.y1, s.height);
    }
  }
  return f.build();
}
