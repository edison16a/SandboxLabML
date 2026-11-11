import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

/**
 * A pool of crisp screen space line segments a few pixels wide, rewritten
 * every frame in place. WebGL lines are one hair thin; these stay legible
 * at any pixel ratio. Buffers are made once at full capacity, so a frame
 * only writes numbers and moves the draw count.
 */
export class FatLines {
  readonly object: LineSegments2;
  readonly material: LineMaterial;
  private readonly geometry: LineSegmentsGeometry;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private n = 0;

  constructor(
    readonly capacity: number,
    width: number,
  ) {
    this.pos = new Float32Array(capacity * 6);
    this.col = new Float32Array(capacity * 6);
    this.geometry = new LineSegmentsGeometry();
    this.geometry.setPositions(this.pos);
    this.geometry.setColors(this.col);
    this.material = new LineMaterial({ linewidth: width, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });
    this.material.blending = THREE.AdditiveBlending;
    this.object = new LineSegments2(this.geometry, this.material);
    this.object.frustumCulled = false;
  }

  begin(): void {
    this.n = 0;
  }

  /** Adds a segment from a to b, colored c with brightness k. */
  add(ax: number, ay: number, az: number, bx: number, by: number, bz: number, c: THREE.Color, k = 1): void {
    if (this.n >= this.capacity) return;
    const o = this.n * 6;
    this.pos[o] = ax;
    this.pos[o + 1] = ay;
    this.pos[o + 2] = az;
    this.pos[o + 3] = bx;
    this.pos[o + 4] = by;
    this.pos[o + 5] = bz;
    this.col[o] = this.col[o + 3] = c.r * k;
    this.col[o + 1] = this.col[o + 4] = c.g * k;
    this.col[o + 2] = this.col[o + 5] = c.b * k;
    this.n++;
  }

  /** Uploads what was added this frame and sizes the lines for the canvas. */
  finish(width: number, height: number): void {
    (this.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
    (this.geometry.attributes.instanceColorStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
    this.geometry.instanceCount = this.n;
    this.material.resolution.set(width, height);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
