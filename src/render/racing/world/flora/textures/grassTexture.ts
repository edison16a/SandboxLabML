import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';

/**
 * A clump of dry summer grass for the verge cards: tapered blades curving
 * up and over from a dense base, olive and brown at the root, pale straw
 * at the tips, with a few greener blades and seed heads. Wider than tall,
 * so a card holds a whole clump.
 */
export function grassTexture(width = 256): THREE.CanvasTexture {
  const w = width;
  const h = width / 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const rng = new Rng(707);
  for (let k = 0; k < 90; k++) {
    // Roots bunch toward the middle; outer blades are shorter and lean out.
    const x = w * (0.5 + (rng.next() - 0.5) * (0.35 + 0.6 * rng.next()));
    const out = (x - w / 2) / (w / 2);
    const height = h * rng.range(0.45, 0.97) * (1 - Math.abs(out) * 0.35);
    const lean = (out * 0.5 + rng.range(-0.3, 0.3)) * height;
    const base = w * rng.range(0.008, 0.016);
    const green = rng.next() < 0.18;
    const grad = g.createLinearGradient(0, h, 0, h - height);
    grad.addColorStop(0, green ? '#4a5326' : '#4e4425');
    grad.addColorStop(0.45, green ? '#7d8a45' : '#9a8448');
    grad.addColorStop(1, green ? '#b8b878' : `rgb(${210 + rng.int(25)},${186 + rng.int(25)},${128 + rng.int(25)})`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - base, h);
    g.quadraticCurveTo(x - base * 0.4 + lean * 0.35, h - height * 0.6, x + lean, h - height);
    g.quadraticCurveTo(x + base * 0.4 + lean * 0.35, h - height * 0.6, x + base, h);
    g.closePath();
    g.fill();
    // Now and then a seed head at the tip.
    if (rng.next() < 0.12) {
      g.fillStyle = '#d9c48e';
      g.beginPath();
      g.ellipse(x + lean, h - height + 3, base * 0.9, base * 3, Math.atan2(lean, height), 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
