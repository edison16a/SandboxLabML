'use client';

import * as THREE from 'three';
import type { Track } from '@/engine/racing/track/types';
import { useDisposable } from '@/render/shared/useDisposable';
import { sideOffset } from '../trackGeometry';
import type { StadiumLayout } from './layout';

/** Fence height above the wall top, m. */
const TOP = 4.4;
const BASE = 0.9;

/** A chain link pattern with transparent holes. Mipmaps fade it to a light veil at a distance, like real mesh. */
function meshTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.strokeStyle = 'rgba(200,205,210,1)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(64, 64);
  g.moveTo(64, 0);
  g.lineTo(0, 64);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * The catch fence on the wall in front of the grandstands, following the
 * wall round any bend: mesh panels, posts every 3 m and a top rail. Only
 * spans the stands, like the fences at a real main straight.
 */
function fenceGeometry(track: Track, layout: StadiumLayout, offset: number): { mesh: THREE.BufferGeometry; posts: THREE.BufferGeometry } | null {
  if (!layout.stands.length) return null;
  const lo = Math.min(...layout.stands.map((s) => s.along - s.length / 2)) - 4;
  const hi = Math.max(...layout.stands.map((s) => s.along + s.length / 2)) + 4;
  // Local +z of the start frame is the road's right, so the stand side's lateral offset has the opposite sign.
  const lat = -layout.side * offset;
  const pos: number[] = [];
  const uv: number[] = [];
  const posts: THREE.BufferGeometry[] = [];
  let run = 0;
  const from = Math.floor(lo / track.spacing);
  const to = Math.ceil(hi / track.spacing);
  for (let k = from; k < to; k++) {
    const i = (k + track.count) % track.count;
    const j = (k + 1 + track.count) % track.count;
    const [ax, az] = sideOffset(track, i, lat);
    const [bx, bz] = sideOffset(track, j, lat);
    const len = Math.hypot(bx - ax, bz - az);
    pos.push(ax, BASE, az, bx, BASE, bz, ax, TOP, az, ax, TOP, az, bx, BASE, bz, bx, TOP, bz);
    // A diamond about 12 cm across, like real chain link; mipmaps turn it into a light veil further away.
    const u0 = run / 0.12;
    const u1 = (run + len) / 0.12;
    const v = (TOP - BASE) / 0.12;
    uv.push(u0, 0, u1, 0, u0, v, u0, v, u1, 0, u1, v);
    if (Math.floor(run / 3) !== Math.floor((run + len) / 3)) posts.push(new THREE.BoxGeometry(0.1, TOP + 0.3, 0.1).translate(ax, (TOP + 0.3) / 2, az));
    run += len;
  }
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  mesh.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  mesh.computeVertexNormals();
  const merged = new THREE.BufferGeometry();
  const all = posts.flatMap((p) => Array.from(p.toNonIndexed().attributes.position.array));
  merged.setAttribute('position', new THREE.Float32BufferAttribute(all, 3));
  merged.computeVertexNormals();
  posts.forEach((p) => p.dispose());
  return { mesh, posts: merged };
}

export function Fence({ track, layout, offset }: { track: Track; layout: StadiumLayout; offset: number }) {
  const built = useDisposable(() => {
    const geo = fenceGeometry(track, layout, offset);
    const tex = meshTexture();
    const net = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
    const steel = new THREE.MeshStandardMaterial({ color: '#8a9098', roughness: 0.4, metalness: 0.7 });
    return { geo, net, steel, dispose: () => [geo?.mesh, geo?.posts, tex, net, steel].forEach((x) => x?.dispose()) };
  }, [track, layout, offset]);
  if (!built.geo) return null;
  return (
    <group>
      <mesh geometry={built.geo.mesh} material={built.net} />
      <mesh geometry={built.geo.posts} material={built.steel} castShadow />
    </group>
  );
}
