'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HIT_CAR, HIT_NONE, HIT_PED, HIT_STATIC } from '@/engine/driving/sensors/lidar';
import { useDisposable } from '@/render/shared/useDisposable';
import { FRAME_PRIORITY } from '../frame/FrameDriver';
import { useDrivingScene } from '../frame/sceneContext';
import { glowTexture } from '../city/streetscape/glow';
import { hitColor } from './palette';

const MAX = 64;
/** The sensor's height on the roof, m. */
const ROOF = 1.78;
/** Where a beam lands on what it hit, m: the top of a curb, a car's flank, a person's chest. A miss fades out at 1 m. */
const LAND = { [HIT_NONE]: 1.0, [HIT_STATIC]: 0.12, [HIT_CAR]: 0.7, [HIT_PED]: 1.1 } as Record<number, number>;

/**
 * The lidar the brain reads, drawn as a fan of fine beams from the roof
 * sensor out to where each one stops, brightest at the far end, with a
 * glowing dot on whatever it hit: cyan for curbs and walls, amber for cars,
 * magenta for people. A beam that reaches its full range fades out
 * instead. The overlay runs the engine's own lidar on the drawn world, so
 * every beam is one the brain really has.
 */
export function LidarBeams() {
  const { frame } = useDrivingScene();
  const built = useDisposable(() => {
    const lines = new THREE.BufferGeometry();
    lines.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    lines.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const dots = new THREE.BufferGeometry();
    dots.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
    dots.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const tex = glowTexture();
    const dotMat = new THREE.PointsMaterial({ size: 0.55, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true });
    return { lines, dots, lineMat, dotMat, dispose: () => [lines, dots, lineMat, dotMat, tex].forEach((x) => x.dispose()) };
  }, []);

  useFrame(() => {
    const s = frame.sense;
    const lp = built.lines.attributes.position as THREE.BufferAttribute;
    const lc = built.lines.attributes.color as THREE.BufferAttribute;
    const dp = built.dots.attributes.position as THREE.BufferAttribute;
    const dc = built.dots.attributes.color as THREE.BufferAttribute;
    if (!s.valid || frame.focus < 0) {
      built.lines.setDrawRange(0, 0);
      built.dots.setDrawRange(0, 0);
      return;
    }
    const x = frame.pos.x;
    const z = frame.pos.z;
    // The sensor sits a little ahead of the roof's middle.
    const ox = x + Math.cos(frame.yaw) * 0.25;
    const oz = z - Math.sin(frame.yaw) * 0.25;
    let dots = 0;
    for (let i = 0; i < s.beams; i++) {
      const a = frame.yaw + s.angles[i];
      const d = s.dist[i];
      const hx = x + Math.cos(a) * d;
      const hz = z - Math.sin(a) * d;
      const kind = s.kind[i];
      const c = hitColor(kind);
      const far = kind === HIT_NONE ? 0.18 : 0.55;
      lp.setXYZ(i * 2, ox, ROOF, oz);
      const land = LAND[kind] ?? 1;
      lp.setXYZ(i * 2 + 1, hx, land, hz);
      lc.setXYZ(i * 2, c.r * 0.04, c.g * 0.04, c.b * 0.04);
      lc.setXYZ(i * 2 + 1, c.r * far, c.g * far, c.b * far);
      if (kind !== HIT_NONE) {
        dp.setXYZ(dots, hx, land, hz);
        dc.setXYZ(dots, c.r * 0.9, c.g * 0.9, c.b * 0.9);
        dots++;
      }
    }
    built.lines.setDrawRange(0, s.beams * 2);
    built.dots.setDrawRange(0, dots);
    lp.needsUpdate = lc.needsUpdate = dp.needsUpdate = dc.needsUpdate = true;
  }, FRAME_PRIORITY.overlay);

  return (
    <group>
      <lineSegments geometry={built.lines} material={built.lineMat} frustumCulled={false} renderOrder={6} />
      <points geometry={built.dots} material={built.dotMat} frustumCulled={false} renderOrder={7} />
    </group>
  );
}
