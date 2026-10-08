import * as THREE from 'three';
import { ATLAS_COLS, ATLAS_ROWS, TILE } from './atlasLayout';
import { paintBark, paintBrush, paintLeaves, paintNeedles } from './paintFoliage';

/** Atlas tile size per tier, px. Low paints smaller tiles. */
export const ATLAS_TILE = { low: 128, medium: 256, high: 256 } as const;

let shared: { texture: THREE.CanvasTexture; size: number } | null = null;
let users = 0;

/**
 * The foliage atlas, painted once into a canvas: pine needle tufts, leaf
 * sprays, scrub and bark, laid out as atlasLayout says. `tile` is the edge
 * of one tile in pixels; Low asks for smaller tiles. One copy is shared by
 * every scene; release it with `releaseFoliageAtlas`.
 */
export function foliageAtlas(tile: number): THREE.CanvasTexture {
  users++;
  if (shared && shared.size === tile) return shared.texture;
  shared?.texture.dispose();
  const c = document.createElement('canvas');
  c.width = tile * ATLAS_COLS;
  c.height = tile * ATLAS_ROWS;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const at = (i: number): [number, number] => [(i % ATLAS_COLS) * tile, Math.floor(i / ATLAS_COLS) * tile];
  const clip = (i: number, paint: (x: number, y: number) => void) => {
    const [x, y] = at(i);
    g.save();
    g.beginPath();
    g.rect(x, y, tile, tile);
    g.clip();
    paint(x, y);
    g.restore();
  };
  clip(TILE.needles, (x, y) => paintNeedles(g, x, y, tile, 11, 0));
  clip(TILE.needleTips, (x, y) => paintNeedles(g, x, y, tile, 23, 1));
  clip(TILE.leaves, (x, y) => paintLeaves(g, x, y, tile, 31, { dark: [28, 44, 18], lit: [104, 132, 52] }, 0.034, 420));
  clip(TILE.leavesLight, (x, y) => paintLeaves(g, x, y, tile, 37, { dark: [44, 60, 24], lit: [150, 162, 74] }, 0.03, 380));
  clip(TILE.scrub, (x, y) => paintLeaves(g, x, y, tile, 41, { dark: [46, 58, 34], lit: [138, 150, 102] }, 0.022, 620));
  clip(TILE.brush, (x, y) => paintBrush(g, x, y, tile, 47));
  clip(TILE.pineBark, (x, y) => paintBark(g, x, y, tile, 53, [108, 70, 50], [42, 28, 22]));
  clip(TILE.greyBark, (x, y) => paintBark(g, x, y, tile, 59, [104, 96, 86], [52, 48, 44]));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  shared = { texture: t, size: tile };
  return t;
}

/** Drops one user of the atlas and frees it on the GPU once nobody holds it. */
export function releaseFoliageAtlas(): void {
  users = Math.max(0, users - 1);
  if (users === 0 && shared) {
    shared.texture.dispose();
    shared = null;
  }
}
