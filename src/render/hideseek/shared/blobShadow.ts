import * as THREE from 'three';

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
