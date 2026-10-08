import * as THREE from 'three';

/**
 * One clump of dry grass: three cards of the grass texture crossing at 60
 * degrees, a meter wide and half a meter tall at scale 1, so it reads as a
 * full clump from any side. Normals point straight up, so the grass lights
 * like the ground under it, and the roots are a little darker.
 */
export function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const w = 0.5;
  const h = 0.5;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    const cx = Math.cos(a) * w;
    const cz = Math.sin(a) * w;
    const v = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, h, cz, -cx, h, -cz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    col.push(0.78, 0.78, 0.78, 0.78, 0.78, 0.78, 1, 1, 1, 1, 1, 1);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
