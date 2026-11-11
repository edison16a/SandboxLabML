import * as THREE from 'three';
import { NAV_COLORS } from '../palette';
import { beamMaterial, floorMarkMaterial, hitMaterial } from './senseMaterials';

/** Height of the sensor beams over the floor, m: about the runner's middle. */
export const SENSE_Y = 0.55;
const MAX_BEAMS = 64;
const MAX_DOTS = 32;

/** A flat unit quad lying on the floor, local x from 0 to 1 (or centered), local z across. */
function floorQuad(fromOrigin: boolean): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  if (fromOrigin) g.translate(0.5, 0, 0);
  return g;
}

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, count: number): { mesh: THREE.InstancedMesh; aux: THREE.InstancedBufferAttribute } {
  const aux = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aBeam', aux);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.setColorAt(0, new THREE.Color());
  return { mesh, aux };
}

/** Marks an instanced part's buffers dirty after a fill of `n` instances. */
function flush(part: { mesh: THREE.InstancedMesh; aux: THREE.InstancedBufferAttribute }, n: number): void {
  part.mesh.count = n;
  part.mesh.instanceMatrix.needsUpdate = true;
  if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
  part.aux.needsUpdate = true;
}

/**
 * Everything the sensor overlay draws, as a handful of instanced meshes
 * rewritten in place every frame: beams, hit markers, the dotted path hint
 * trail and the goal arrow. Nothing is allocated per frame.
 */
export class SensorDrawing {
  readonly group = new THREE.Group();
  private readonly beams;
  private readonly dots;
  private readonly arrow;
  private readonly hits: THREE.Points;
  private readonly hitPos: THREE.BufferAttribute;
  private readonly hitCol: THREE.BufferAttribute;
  private readonly hitMat: THREE.ShaderMaterial;
  private nb = 0;
  private nd = 0;
  private nh = 0;
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.beams = instanced(floorQuad(true), beamMaterial(new THREE.Color(NAV_COLORS.senseBeam)), MAX_BEAMS);
    this.dots = instanced(floorQuad(false), floorMarkMaterial('dot'), MAX_DOTS);
    this.arrow = instanced(floorQuad(false), floorMarkMaterial('chevron'), 1);
    this.beams.mesh.renderOrder = 6;
    this.dots.mesh.renderOrder = 5;
    this.arrow.mesh.renderOrder = 5;
    const g = new THREE.BufferGeometry();
    this.hitPos = new THREE.BufferAttribute(new Float32Array(MAX_BEAMS * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.hitCol = new THREE.BufferAttribute(new Float32Array(MAX_BEAMS * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.hitPos);
    g.setAttribute('aColor', this.hitCol);
    this.hitMat = hitMaterial();
    this.hits = new THREE.Points(g, this.hitMat);
    this.hits.frustumCulled = false;
    this.hits.renderOrder = 7;
    this.group.add(this.beams.mesh, this.dots.mesh, this.arrow.mesh, this.hits);
  }

  begin(viewportHeight: number): void {
    this.nb = this.nd = this.nh = 0;
    this.hitMat.uniforms.uScale.value = viewportHeight / (2 * Math.tan((42 * Math.PI) / 360));
  }

  private place(x: number, y: number, z: number, angle: number, sx: number, sz: number): THREE.Matrix4 {
    this.p.set(x, y, z);
    this.q.setFromAxisAngle(this.up, angle);
    this.s.set(sx, 1, sz);
    return this.m.compose(this.p, this.q, this.s);
  }

  /** A beam from (x, z) at world angle `angle` (0 along +x, positive toward -z), `length` m long. */
  beam(x: number, z: number, angle: number, length: number, color: THREE.Color, hit: boolean, highlighted: boolean): void {
    if (this.nb >= MAX_BEAMS || length < 0.05) return;
    const i = this.nb++;
    this.beams.mesh.setMatrixAt(i, this.place(x, SENSE_Y, z, angle, length, highlighted ? 0.17 : 0.1));
    this.beams.mesh.setColorAt(i, color);
    this.beams.aux.setXY(i, hit ? 1 : 0, highlighted ? 1 : 0);
  }

  /** A hit marker at (x, y, z) in `color`. */
  hit(x: number, y: number, z: number, color: THREE.Color): void {
    if (this.nh >= MAX_BEAMS) return;
    const i = this.nh++;
    this.hitPos.setXYZ(i, x, y, z);
    this.hitCol.setXYZ(i, color.r, color.g, color.b);
  }

  /** A dot of the path hint trail, `size` m across. */
  dot(x: number, z: number, size: number, alpha: number, color: THREE.Color): void {
    if (this.nd >= MAX_DOTS) return;
    const i = this.nd++;
    this.dots.mesh.setMatrixAt(i, this.place(x, 0.014, z, 0, size, size));
    this.dots.mesh.setColorAt(i, color);
    this.dots.aux.setXY(i, alpha, 0);
  }

  /** The goal arrow at (x, z), pointing along world angle `angle`, or hidden when alpha is 0. */
  goal(x: number, z: number, angle: number, alpha: number, color: THREE.Color): void {
    this.arrow.mesh.setMatrixAt(0, this.place(x, 0.016, z, angle, 0.8, 0.8));
    this.arrow.mesh.setColorAt(0, color);
    this.arrow.aux.setXY(0, alpha, 0);
    this.arrow.mesh.count = alpha > 0 ? 1 : 0;
  }

  end(): void {
    flush(this.beams, this.nb);
    flush(this.dots, this.nd);
    flush(this.arrow, this.arrow.mesh.count);
    this.hits.geometry.setDrawRange(0, this.nh);
    this.hitPos.needsUpdate = this.hitCol.needsUpdate = true;
  }

  hide(): void {
    this.beams.mesh.count = this.dots.mesh.count = this.arrow.mesh.count = 0;
    this.hits.geometry.setDrawRange(0, 0);
  }

  dispose(): void {
    for (const m of [this.beams.mesh, this.dots.mesh, this.arrow.mesh]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
    this.hits.geometry.dispose();
    this.hitMat.dispose();
  }
}
