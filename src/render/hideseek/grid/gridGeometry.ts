import * as THREE from 'three';
import { ARENA_SPAN } from '../layout/gridLattice';

/** A unit cube standing on the floor (y from 0 to 1), scaled per instance into walls and boxes. */
export function standingUnitBox(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return g;
}

/**
 * A flat fan for a vision cone on the grid: apex at the origin, centered on
 * +x, `fov` wide. Vertex alpha fades from the apex outwards, so plain
 * alpha blending gives a soft cone with no texture.
 */
export function fanGeometry(radius: number, fov: number, segments = 16): THREE.BufferGeometry {
  const pos: number[] = [0, 0, 0];
  const col: number[] = [1, 1, 1, 0.55];
  for (let k = 0; k <= segments; k++) {
    const a = -fov / 2 + (fov * k) / segments;
    pos.push(Math.cos(a) * radius, 0, -Math.sin(a) * radius);
    col.push(1, 1, 1, 0);
  }
  const index: number[] = [];
  for (let k = 1; k <= segments; k++) index.push(0, k, k + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(index);
  return g;
}

/** A thin square frame just outside an arena's outer walls, for the balance tint. */
export function borderGeometry(width = 0.35): THREE.BufferGeometry {
  const o = ARENA_SPAN / 2 + 0.25 + width;
  const i = ARENA_SPAN / 2 + 0.25;
  const shape = new THREE.Shape([new THREE.Vector2(-o, -o), new THREE.Vector2(o, -o), new THREE.Vector2(o, o), new THREE.Vector2(-o, o)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(-i, -i), new THREE.Vector2(-i, i), new THREE.Vector2(i, i), new THREE.Vector2(i, -i)]));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A floor quad, centered, facing up. */
export function floorQuad(size: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Soft round shadow drawn once to a canvas, for use as an alpha map: three
 * reads alpha maps from the green channel, so the falloff is drawn in gray,
 * white (solid) in the middle to black (clear) at the rim.
 */
export function blobTexture(size = 64): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgb(255,255,255)');
  grad.addColorStop(0.45, 'rgb(140,140,140)');
  grad.addColorStop(1, 'rgb(0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

let sharedBlob: THREE.CanvasTexture | null = null;

/** One blob texture for every character and crate shadow of the showcase, kept for the page's life. */
export function sharedBlobTexture(): THREE.CanvasTexture {
  sharedBlob ??= blobTexture();
  return sharedBlob;
}
