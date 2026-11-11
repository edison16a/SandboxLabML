'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Route } from '@/engine/driving/route/route';
import { useDisposable } from '@/render/shared/useDisposable';
import { useDrivingScene } from '../frame/sceneContext';
import { SENSOR } from './palette';

/** How far ahead of the car the plan is drawn, m, and the ribbon's width. */
const AHEAD = 110;
const WIDTH = 2.5;
const LIFT = 0.035;

/** A strip along the whole route with each vertex's route arc length, so a shader can show just the stretch ahead. */
function ribbonGeometry(route: Route): THREE.BufferGeometry {
  const p = route.path;
  const pos = new Float32Array(p.n * 2 * 3);
  const across = new Float32Array(p.n * 2);
  const along = new Float32Array(p.n * 2);
  for (let i = 0; i < p.n; i++) {
    const nx = -p.ty[i] * (WIDTH / 2);
    const ny = p.tx[i] * (WIDTH / 2);
    pos.set([p.x[i] + nx, LIFT, -(p.y[i] + ny), p.x[i] - nx, LIFT, -(p.y[i] - ny)], i * 6);
    across.set([1, -1], i * 2);
    along.set([p.s[i], p.s[i]], i * 2);
  }
  const index: number[] = [];
  for (let i = 0; i < p.n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aAcross', new THREE.BufferAttribute(across, 1));
  g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

const vertex = /* glsl */ `
attribute float aAcross;
attribute float aAlong;
varying float vAcross;
varying float vAlong;
void main() {
  vAcross = aAcross;
  vAlong = aAlong;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * The plan: a soft glowing band the width of the car, with chevrons
 * flowing forward inside it at a steady pace, so the way ahead and the
 * direction of travel read at a glance, turn included. It fades in just
 * ahead of the car and out toward the horizon. Past the destination
 * nothing is drawn.
 */
const fragment = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;
uniform float uDest;
uniform float uTime;
uniform float uOpacity;
varying float vAcross;
varying float vAlong;
void main() {
  float ahead = vAlong - uProgress;
  if (ahead < 1.5 || vAlong > uDest + 1.0) discard;
  float fadeIn = smoothstep(1.5, 9.0, ahead);
  float fadeOut = 1.0 - smoothstep(${AHEAD * 0.55}, ${AHEAD.toFixed(1)}, ahead);
  float edge = 1.0 - abs(vAcross);
  float fill = smoothstep(0.0, 0.5, edge) * 0.52;
  // Chevrons: a stripe whose ends trail behind its middle, so it points forward, sliding along at 6 m/s.
  float f = fract((vAlong + abs(vAcross) * 2.2 - uTime * 6.0) / 4.6);
  float chevron = smoothstep(0.0, 0.04, f) * (1.0 - smoothstep(0.17, 0.23, f)) * smoothstep(0.06, 0.3, edge);
  float a = (fill + chevron * 0.62) * fadeIn * fadeOut * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** The followed SUV's route ahead, laid on the road surface. */
export function RouteRibbon({ route }: { route: Route }) {
  const { frame } = useDrivingScene();
  const built = useDisposable(() => {
    const geometry = ribbonGeometry(route);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uColor: { value: SENSOR.route }, uProgress: { value: 0 }, uDest: { value: route.destS }, uTime: { value: 0 }, uOpacity: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      toneMapped: false,
    });
    return { geometry, material, dispose: () => (geometry.dispose(), material.dispose()) };
  }, [route]);
  useFrame((_, dt) => {
    const u = built.material.uniforms;
    u.uTime.value += Math.min(dt, 0.1);
    u.uProgress.value = frame.sense.valid ? frame.sense.pose.progress : frame.progress;
  });
  return <mesh geometry={built.geometry} material={built.material} renderOrder={4} frustumCulled={false} />;
}
