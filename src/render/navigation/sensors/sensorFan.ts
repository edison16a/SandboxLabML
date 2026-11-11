import * as THREE from 'three';
import { NAV_COLORS } from '../palette';

const MAX_RAYS = 64;
/** Opacity at the runner's feet and at a ray's end (before the long ray fade): strong enough that the fan, not the beams, carries the read. */
const CENTER_ALPHA = 0.36;
const RIM_ALPHA = 0.17;

/**
 * The floor a runner can see, as a soft shape on the tiles: a fan from its
 * feet out to where each ray stops, so open floor shows as a wide star and
 * a crate or a spike row close by pinches it in. It reads at a glance from
 * any distance, where single beams would be thin lines. One triangle fan,
 * rewritten in place every frame.
 */
export class SensorFan {
  readonly mesh: THREE.Mesh;
  private readonly pos: THREE.BufferAttribute;
  private readonly fade: THREE.BufferAttribute;
  private n = 0;
  private closed = false;
  /** The triangle whose index currently wraps back to the first ray, or -1. */
  private wrapped = -1;

  constructor() {
    const g = new THREE.BufferGeometry();
    // Vertex 0 is the center; rays follow. Triangles are indexed once for the largest fan and drawn in part.
    this.pos = new THREE.BufferAttribute(new Float32Array((MAX_RAYS + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.fade = new THREE.BufferAttribute(new Float32Array(MAX_RAYS + 1), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('aFade', this.fade);
    const index: number[] = [];
    for (let i = 0; i < MAX_RAYS; i++) index.push(0, i + 1, i + 2 > MAX_RAYS ? 1 : i + 2);
    g.setIndex(index);
    const material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aFade;
        varying float vFade;
        void main() {
          vFade = aFade;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(uColor, vFade);
          #include <colorspace_fragment>
        }
      `,
      uniforms: { uColor: { value: new THREE.Color(NAV_COLORS.senseBeam) } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  /** Starts a fan at (x, z). `closed` joins the last ray back to the first, for rays all round. */
  begin(x: number, z: number, closed: boolean): void {
    this.pos.setXYZ(0, x, 0.011, z);
    this.fade.setX(0, CENTER_ALPHA);
    this.n = 0;
    this.closed = closed;
  }

  /** Adds the next ray's end point. Rays must come in order round the fan. */
  ray(x: number, z: number, length: number): void {
    if (this.n >= MAX_RAYS) return;
    this.n++;
    this.pos.setXYZ(this.n, x, 0.011, z);
    // Fades toward the rim, a little more for a long ray, so open floor softens rather than ending on a hard edge,
    // yet the shape still reads from the overview.
    this.fade.setX(this.n, RIM_ALPHA / (1 + length * 0.05));
  }

  end(): void {
    const tris = this.closed ? this.n : Math.max(0, this.n - 1);
    // A closed fan's last triangle must wrap to vertex 1: rebuild just that triangle's index (three entries, since an index has one value per item).
    const index = this.mesh.geometry.index as THREE.BufferAttribute;
    const wrap = this.closed && this.n > 1 ? this.n - 1 : -1;
    if (wrap !== this.wrapped) {
      if (this.wrapped >= 0) index.setXYZ(this.wrapped * 3, 0, this.wrapped + 1, this.wrapped + 2 > MAX_RAYS ? 1 : this.wrapped + 2);
      if (wrap >= 0) index.setXYZ(wrap * 3, 0, wrap + 1, 1);
      this.wrapped = wrap;
      index.needsUpdate = true;
    }
    this.mesh.geometry.setDrawRange(0, tris * 3);
    this.pos.needsUpdate = this.fade.needsUpdate = true;
    this.mesh.visible = tris > 0;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
