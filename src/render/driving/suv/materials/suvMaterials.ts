import * as THREE from 'three';
import { detailTier, type DrivingTier } from '../../quality';
import { discMap, DISC_REPEAT } from '../../textures/disc';
import { flakeNormalMap } from '../../textures/flakes';
import { HONEYCOMB_ASPECT, honeycombColor, honeycombNormal } from '../../textures/grille';
import { wheelBlurMap } from '../../textures/wheelBlur';
import type { Slot } from '../geometry/parts';
import { withStreetReflections } from './streetReflections';

export interface SuvMaterials {
  slots: Record<Slot, THREE.Material>;
  /** The body color, which follows the species of the followed SUV. */
  paint: THREE.MeshPhysicalMaterial;
  /** The rear light bar and lamps, which flare when the SUV brakes. */
  tail: THREE.MeshStandardMaterial;
  /** Smeared spokes drawn over each wheel at speed; the driver sets its opacity. */
  blur: THREE.MeshStandardMaterial;
  dispose(): void;
}

/** How strongly each slot mirrors the environment: paint and glass glossy, tires and liners dull. */
const REFLECT: Partial<Record<Slot, number>> = { paint: 0.75, glass: 1.05, trim: 0.9, clad: 0.6, grille: 0.45, metal: 1, rim: 0.9, face: 1, caliper: 0.8, disc: 0.5, tire: 0.6, liner: 0.25, tail: 0.6 };

/**
 * Tail lamp glow at rest and under braking. The lamps skip tone mapping,
 * so the idle glow stays under full red and braking is a clear step up;
 * with bloom on, only the brake glow crosses its threshold.
 */
export const TAIL_GLOW = { idle: 0.55, brake: 6.5 };

/** The SUV's paint before any generation: a deep metallic blue. */
export const PARKED_PAINT = '#1d4f9a';

const repeat = <T extends THREE.Texture>(t: T, u: number, v = u): T => {
  t.repeat.set(u, v);
  return t;
};

/**
 * Materials for the followed SUV. Paint is a clear coat over a metallic
 * base with flake normals; glass is dark and tinted, near mirror smooth;
 * the trim is gloss black and the cladding a satin dark plastic. Lower
 * tiers drop the texture detail they would not show anyway.
 */
export function createSuvMaterials(tier: DrivingTier): SuvMaterials {
  const d = detailTier(tier);
  const high = d === 'high';
  const textures: THREE.Texture[] = [];
  const keep = <T extends THREE.Texture>(t: T) => (textures.push(t), t);
  // A satin base with little metal and a low sheen keeps the color deep on the hood and roof at any angle. The
  // clear coat on top is near mirror smooth, so buildings and the street's edges reflect crisp in it and the
  // shoulder crease draws a sharp line; the street sky term keeps it from mirroring a white horizon. The flake
  // is only a hint.
  const paint = new THREE.MeshPhysicalMaterial({ color: PARKED_PAINT, metalness: 0.12, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.07, specularIntensity: 0.32 });
  if (d !== 'low') {
    paint.normalMap = keep(repeat(flakeNormalMap(high ? 512 : 256), high ? 14 : 8));
    paint.normalScale.set(0.08, 0.08);
  }
  const mesh = <T extends THREE.Texture>(t: T) => keep(repeat(t, 14, 14 * HONEYCOMB_ASPECT));
  const grille = new THREE.MeshStandardMaterial({ map: mesh(honeycombColor(128)), normalMap: d === 'low' ? null : mesh(honeycombNormal(128)), roughness: 0.4, metalness: 0.4 });
  const disc = new THREE.MeshStandardMaterial({ map: keep(repeat(discMap(128), DISC_REPEAT, 1)), roughness: 0.5, metalness: 0.45 });
  const tail = new THREE.MeshStandardMaterial({ color: '#2a0303', emissive: '#ff1608', emissiveIntensity: TAIL_GLOW.idle, roughness: 0.25, toneMapped: false });
  const blur = new THREE.MeshStandardMaterial({ map: keep(wheelBlurMap(high ? 256 : 128)), transparent: true, opacity: 0, depthWrite: false, metalness: 0.7, roughness: 0.35, envMapIntensity: 0.8, side: THREE.DoubleSide });
  const slots: Record<Slot, THREE.Material> = {
    paint,
    grille,
    disc,
    tail,
    glass: new THREE.MeshPhysicalMaterial({ color: '#0b0f14', metalness: 0.1, roughness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.03 }),
    trim: new THREE.MeshPhysicalMaterial({ color: '#08090b', metalness: 0.2, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 }),
    // Satin, a shade off black: it catches the sky, so it reads as trim on the body and never merges with the shadow under it.
    clad: new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.5, metalness: 0.05 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 4.2, 3.9), toneMapped: false }),
    liner: new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: 0.16 }),
    // Satin rubber a shade lighter than the black well, with a soft sheen that lights the rounded shoulder
    // where it turns away from the eye, so the full 0.8 m tire reads against the dark arch.
    tire: new THREE.MeshPhysicalMaterial({ color: '#232529', roughness: 0.68, sheen: d === 'low' ? 0 : 0.8, sheenRoughness: 0.5, sheenColor: '#7d838c' }),
    rim: new THREE.MeshPhysicalMaterial({ color: '#2c2f34', metalness: 0.75, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
    face: new THREE.MeshPhysicalMaterial({ color: '#c3c7cc', metalness: 1, roughness: 0.27, clearcoat: 0.6, clearcoatRoughness: 0.12 }),
    caliper: new THREE.MeshPhysicalMaterial({ color: '#b01c14', roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 }),
  };
  for (const [slot, k] of Object.entries(REFLECT)) (slots[slot as Slot] as THREE.MeshStandardMaterial).envMapIntensity = k;
  // The glossy surfaces see the street's buildings low down, not open sky, so they keep their color.
  for (const slot of ['paint', 'glass', 'trim'] as const) withStreetReflections(slots[slot] as THREE.MeshPhysicalMaterial);
  return {
    slots,
    paint,
    tail,
    blur,
    dispose: () => {
      Object.values(slots).forEach((m) => m.dispose());
      blur.dispose();
      textures.forEach((t) => t.dispose());
    },
  };
}
