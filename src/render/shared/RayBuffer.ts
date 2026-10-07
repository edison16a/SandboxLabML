import * as THREE from 'three';

const FAR = new THREE.Color('#3dd68c');
const NEAR = new THREE.Color('#ff4d4d');

/**
 * One LineSegments buffer for sensor rays, rewritten in place every frame.
 * Rays fade from green (open road) to red (wall close); a hovered input is
 * drawn in the highlight color, white unless the scene is too pale for it.
 * Hit points go into a Points buffer so each ray ends in a dot.
 */
export class RayBuffer {
  readonly lines: THREE.LineSegments;
  readonly dots: THREE.Points;
  private readonly pos: THREE.BufferAttribute;
  private readonly col: THREE.BufferAttribute;
  private readonly dotPos: THREE.BufferAttribute;
  private readonly dotCol: THREE.BufferAttribute;
  private n = 0;
  private readonly c = new THREE.Color();
  private readonly hot: THREE.Color;

  constructor(readonly capacity: number, highlight: THREE.ColorRepresentation = '#ffffff') {
    this.hot = new THREE.Color(highlight);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(capacity * 6), 3).setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.BufferAttribute(new Float32Array(capacity * 6), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('color', this.col);
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 10;
    const d = new THREE.BufferGeometry();
    this.dotPos = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.dotCol = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    d.setAttribute('position', this.dotPos);
    d.setAttribute('color', this.dotCol);
    this.dots = new THREE.Points(d, new THREE.PointsMaterial({ size: 0.45, vertexColors: true, depthTest: false, toneMapped: false }));
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 11;
  }

  /** Rays added since the last begin(). */
  get count(): number {
    return this.n;
  }

  begin(): void {
    this.n = 0;
  }

  /**
   * Adds a ray from (x0, z0) at height y to (x1, z1) at height y1 (y unless
   * given). `closeness` is 0 for nothing hit and 1 for touching.
   */
  add(x0: number, z0: number, x1: number, z1: number, y: number, closeness: number, highlighted: boolean, hit: boolean, y1 = y): void {
    if (this.n >= this.capacity) return;
    const i = this.n++;
    // Written element by element: thousands of rays a frame must not allocate.
    const p = this.pos.array as Float32Array;
    p[i * 6] = x0;
    p[i * 6 + 1] = y;
    p[i * 6 + 2] = z0;
    p[i * 6 + 3] = x1;
    p[i * 6 + 4] = y1;
    p[i * 6 + 5] = z1;
    if (highlighted) this.c.copy(this.hot);
    else this.c.copy(FAR).lerp(NEAR, Math.min(1, Math.max(0, closeness)));
    const { r, g, b } = this.c;
    const c = this.col.array as Float32Array;
    c[i * 6] = r * 0.6;
    c[i * 6 + 1] = g * 0.6;
    c[i * 6 + 2] = b * 0.6;
    c[i * 6 + 3] = r;
    c[i * 6 + 4] = g;
    c[i * 6 + 5] = b;
    const d = this.dotPos.array as Float32Array;
    d[i * 3] = hit ? x1 : x0;
    d[i * 3 + 1] = hit ? y1 : -1000;
    d[i * 3 + 2] = hit ? z1 : z0;
    const dc = this.dotCol.array as Float32Array;
    dc[i * 3] = r;
    dc[i * 3 + 1] = g;
    dc[i * 3 + 2] = b;
  }

  /** Paints the end dot of the ray added last, e.g. in the color of what it hit. */
  tintDot(color: THREE.Color): void {
    if (this.n === 0) return;
    const dc = this.dotCol.array as Float32Array;
    const i = (this.n - 1) * 3;
    dc[i] = color.r;
    dc[i + 1] = color.g;
    dc[i + 2] = color.b;
  }

  end(): void {
    this.lines.geometry.setDrawRange(0, this.n * 2);
    this.dots.geometry.setDrawRange(0, this.n);
    this.pos.needsUpdate = this.col.needsUpdate = this.dotPos.needsUpdate = this.dotCol.needsUpdate = true;
  }

  dispose(): void {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
    this.dots.geometry.dispose();
    (this.dots.material as THREE.Material).dispose();
  }
}
