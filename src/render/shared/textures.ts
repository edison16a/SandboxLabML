import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';

/**
 * Procedural textures drawn once into a canvas. Everything is generated, so
 * the 3D views download no image files and look the same offline.
 */
function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

function finish(c: HTMLCanvasElement, repeat: number, color = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Fine grey noise with darker tar patches and light aggregate specks. */
export function asphaltTexture(size = 512): THREE.CanvasTexture {
  const [c, g] = canvas(size);
  const rng = new Rng(17);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = rng.next();
    let v = 58 + n * 22;
    if (n > 0.985) v = 120 + rng.next() * 50;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v + 3;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.08;
  for (let k = 0; k < 40; k++) {
    g.fillStyle = rng.next() > 0.5 ? '#000' : '#9aa';
    g.beginPath();
    g.ellipse(rng.next() * size, rng.next() * size, 10 + rng.next() * 50, 6 + rng.next() * 30, rng.next() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c, 1);
}

/** Roughness for asphalt: mostly rough with smoother worn streaks. */
export function asphaltRoughness(size = 256): THREE.CanvasTexture {
  const [c, g] = canvas(size);
  const rng = new Rng(23);
  g.fillStyle = 'rgb(225,225,225)';
  g.fillRect(0, 0, size, size);
  g.globalAlpha = 0.12;
  for (let k = 0; k < 60; k++) {
    const v = 120 + rng.next() * 80;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rng.next() * size, 0, 1 + rng.next() * 3, size);
  }
  return finish(c, 1, false);
}

/** Grass with clumps and soft mowing stripes. */
export function grassTexture(size = 512): THREE.CanvasTexture {
  const [c, g] = canvas(size);
  const rng = new Rng(5);
  g.fillStyle = '#3f6b2f';
  g.fillRect(0, 0, size, size);
  for (let k = 0; k < 9000; k++) {
    const shade = rng.next();
    g.fillStyle = `rgba(${40 + shade * 50},${80 + shade * 60},${30 + shade * 25},0.35)`;
    g.fillRect(rng.next() * size, rng.next() * size, 1 + rng.next() * 2, 2 + rng.next() * 5);
  }
  g.globalAlpha = 0.06;
  for (let s = 0; s < size; s += 64) {
    g.fillStyle = (s / 64) % 2 ? '#ffffff' : '#000000';
    g.fillRect(0, s, size, 32);
  }
  return finish(c, 1);
}

/** Pale sand and gravel for run-off areas. */
export function gravelTexture(size = 256): THREE.CanvasTexture {
  const [c, g] = canvas(size);
  const rng = new Rng(9);
  g.fillStyle = '#b9a98a';
  g.fillRect(0, 0, size, size);
  for (let k = 0; k < 6000; k++) {
    const v = rng.next();
    g.fillStyle = `rgba(${150 + v * 70},${135 + v * 60},${105 + v * 50},0.5)`;
    g.fillRect(rng.next() * size, rng.next() * size, 1 + rng.next() * 2, 1 + rng.next() * 2);
  }
  return finish(c, 1);
}

/** Black and white checks for the start line. */
export function checkerTexture(cells = 8): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  const s = 256 / cells;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4';
      g.fillRect(i * s, j * s, s, s);
    }
  }
  const t = finish(c, 1);
  t.magFilter = THREE.NearestFilter;
  return t;
}
