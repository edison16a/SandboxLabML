'use client';

import * as THREE from 'three';
import type { Course } from '@/engine/navigation/course/build';
import { START_PAD_RADIUS } from '@/engine/navigation/course/types';
import { EMBLEM_GLSL } from '@/render/hideseek/room/emblem';
import { useDisposable } from '@/render/shared/useDisposable';
import { NAV_COLORS } from '../palette';

const SIZE = START_PAD_RADIUS * 2;

/**
 * A soft blue disc with a crisp rim, a dashed inner ring and the app's
 * emblem in the middle, all drawn as distance fields so the edges stay
 * crisp from a close follow shot to the overview.
 */
function startPadMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec2 vUv;
      ${EMBLEM_GLSL}
      void main() {
        vec2 p = (vUv - 0.5) * ${SIZE.toFixed(3)};
        float r = length(p);
        float aa = fwidth(r) * 1.2;
        float R = ${START_PAD_RADIUS.toFixed(3)};
        float disc = 1.0 - smoothstep(R - aa, R + aa, r);
        float rim = 1.0 - smoothstep(0.035 - aa, 0.035 + aa, abs(r - (R - 0.07)));
        float ang = atan(p.y, p.x);
        float dashes = step(0.45, fract(ang * 24.0 / 6.2831853));
        float inner = (1.0 - smoothstep(0.018 - aa, 0.018 + aa, abs(r - R * 0.72))) * dashes;
        // The emblem's 28 unit view box spans 1.1 m in the middle of the pad.
        float d = hsEmblem(vec2(p.x, -p.y) / 1.1 * 28.0 + 14.0) * (1.1 / 28.0);
        float mark = 1.0 - smoothstep(-aa, aa, d);
        float a = disc * 0.16 + rim * 0.85 + inner * 0.55 + mark * 0.7;
        vec3 col = mix(uColor, vec3(1.0), mark * 0.25);
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * disc);
        #include <colorspace_fragment>
      }
    `,
    uniforms: { uColor: { value: new THREE.Color(NAV_COLORS.startPad) } },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/** The start pad, where every run begins. */
export function StartPad({ course }: { course: Course }) {
  const material = useDisposable(() => startPadMaterial(), []);
  return (
    <mesh position={[course.startX, 0.007, course.startZ]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} material={material} renderOrder={1} raycast={() => null}>
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  );
}
