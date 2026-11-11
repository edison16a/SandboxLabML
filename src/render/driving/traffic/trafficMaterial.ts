import * as THREE from 'three';
import { withCarSurface } from '../suv/materials/carSurface';
import { withHaze } from '../world/atmosphere';

/**
 * Lamps from the car's own flags, per instance: tail lamps glow softly and
 * flare under braking; an indicator blinks at about 1.5 Hz while its flag
 * is set. Flags pack brake (1), left (2) and right (4), as the world
 * snapshot does.
 */
const LAMPS = /* glsl */ `
float lampCode = vLamp;
float brake = mod(vFlags, 2.0);
float leftOn = mod(floor(vFlags / 2.0), 2.0);
float rightOn = mod(floor(vFlags / 4.0), 2.0);
float blink = step(0.5, fract(uLampTime * 1.5 + vBlinkPhase));
vec3 lampGlow = vec3(0.0);
if (lampCode > 1.5 && lampCode < 2.5) lampGlow = vec3(1.0, 0.06, 0.03) * (0.5 + brake * 3.2);
if (lampCode > 2.5 && lampCode < 3.5) lampGlow = vec3(1.0, 0.45, 0.05) * leftOn * blink * 3.0;
if (lampCode > 3.5 && lampCode < 4.5) lampGlow = vec3(1.0, 0.45, 0.05) * rightOn * blink * 3.0;
totalEmissiveRadiance += lampGlow;`;

/**
 * The traffic car material: one physical material per body type with a
 * clear coat on the paint, the per vertex looks read by withCarSurface,
 * and the lamps above. `time` drives the indicators.
 */
export function createTrafficMaterial(time: { value: number }): THREE.MeshPhysicalMaterial {
  const m = withHaze(withCarSurface(new THREE.MeshPhysicalMaterial({ vertexColors: true, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.9 })));
  const before = m.onBeforeCompile.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.uniforms.uLampTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float lamp;\nattribute float aFlags;\nvarying float vLamp;\nflat varying float vFlags;\nflat varying float vBlinkPhase;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLamp = lamp;\nvFlags = aFlags;\nvBlinkPhase = fract(float(gl_InstanceID) * 0.37);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLampTime;\nvarying float vLamp;\nflat varying float vFlags;\nflat varying float vBlinkPhase;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${LAMPS}`);
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}|traffic-lamps`;
  return m;
}
