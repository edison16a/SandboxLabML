import * as THREE from 'three';
import { NAV_COLORS } from '../palette';

/** The hazard band round a mover: its lower and upper edge, m above the floor, and the width of one stripe pair along the face, m. */
const BAND_LOW = 0.34;
const BAND_HIGH = 0.66;
const STRIPE = 0.34;

const vec = (c: THREE.Color) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

/**
 * Paints a band of diagonal hazard stripes round the side faces of a
 * crate, from its own position and normal, so a mover reads as machinery
 * at a glance and never as one of the still golden crates. The stripes
 * are box filtered across the pixel, so they fade to an even amber far
 * away instead of shimmering.
 */
function withHazardBand(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const trim = new THREE.Color(NAV_COLORS.moverTrim);
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMoverP;\nvarying vec3 vMoverN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMoverP = position;\nvMoverN = normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMoverP;\nvarying vec3 vMoverN;').replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      {
        vec3 p = vMoverP;
        vec3 n = vMoverN;
        float side = 1.0 - step(0.5, abs(n.y));
        // Along the face, turning round the crate so the stripes run on unbroken past a corner.
        float u = abs(n.x) > 0.5 ? p.z * sign(n.x) : -p.x * sign(n.z);
        // Two units per stripe pair, so a square wave of period 2 gives an amber and a dark stripe.
        float q = (u + p.y) / ${STRIPE.toFixed(3)} * 2.0;
        float w = max(fwidth(q), 1e-4);
        // Box filtered square wave (the integral over the pixel), -1 to 1, as in the checkered gate.
        float i = 2.0 * (abs(fract((q - 0.5 * w) * 0.5) - 0.5) - abs(fract((q + 0.5 * w) * 0.5) - 0.5)) / w;
        float stripe = 0.5 - 0.5 * i;
        float aa = max(fwidth(p.y), 1e-4);
        float band = smoothstep(${BAND_LOW.toFixed(3)} - aa, ${BAND_LOW.toFixed(3)} + aa, p.y) * (1.0 - smoothstep(${BAND_HIGH.toFixed(3)} - aa, ${BAND_HIGH.toFixed(3)} + aa, p.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, ${vec(trim)}, stripe * band * side);
      }`,
    );
  };
  m.customProgramCacheKey = () => 'nav-mover-hazard';
  return m;
}

/**
 * A mover's look: a dark graphite body with a hazard striped band and a
 * frame in glowing amber, so it reads apart from the golden crates even
 * from the overview. `full` adds the clear coat.
 */
export function moverMaterials(full: boolean): { panel: THREE.MeshStandardMaterial; brace: THREE.MeshStandardMaterial; dispose: () => void } {
  const body = new THREE.Color(NAV_COLORS.moverBody);
  const panel = withHazardBand(
    full
      ? new THREE.MeshPhysicalMaterial({ color: body, roughness: 0.42, metalness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.25, envMapIntensity: 1 })
      : new THREE.MeshStandardMaterial({ color: body, roughness: 0.45, metalness: 0.28, envMapIntensity: 1 }),
  );
  const trim = new THREE.Color(NAV_COLORS.moverTrim);
  const brace = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.35, metalness: 0, emissive: trim, emissiveIntensity: 0.35, envMapIntensity: 0.9 });
  return {
    panel,
    brace,
    dispose: () => {
      panel.dispose();
      brace.dispose();
    },
  };
}
