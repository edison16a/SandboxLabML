import * as THREE from 'three';
import type { QualityTier } from '@/features/racing/state/labStore';
import type { Slot } from '../geometry/parts';
import { carbonColor, carbonFibers, carbonNormal } from '../textures/carbon';
import { discMap, DISC_REPEAT } from '../textures/disc';
import { flakeNormalMap } from '../textures/flakes';
import { HONEYCOMB_ASPECT, honeycombColor, honeycombNormal } from '../textures/grille';

export interface HeroMaterials {
  slots: Record<Slot, THREE.Material>;
  /** The body color, which follows the species of the followed car. */
  paint: THREE.MeshPhysicalMaterial;
  /** Tail lamps, which flare when the car brakes. */
  tail: THREE.MeshStandardMaterial;
  dispose(): void;
}

/**
 * How strongly each slot mirrors the environment. The scene runs its image
 * lighting dim; the car gets its own, stronger, so paint and glass read as
 * glossy while tires and liners stay dull.
 */
const REFLECT: Partial<Record<Slot, number>> = { paint: 1, carbon: 0.65, glass: 1.1, gold: 1, metal: 1, rim: 0.7, caliper: 0.8, disc: 0.5, tire: 0.4, trim: 0.5, grille: 0.45, liner: 0.3, tail: 0.5 };

/**
 * Tail lamp glow at rest and under braking. The lamps skip tone mapping and
 * only High has bloom, so the idle glow stays below full red. That keeps
 * braking a clear step brighter on every tier, and on High only the brake
 * glow crosses the bloom threshold.
 */
export const TAIL_GLOW = { idle: 0.45, brake: 7 };

/** The parked car's color, before any generation. Driving cars take their species color. */
export const PARKED_PAINT = '#2f6ee8';

const repeat = <T extends THREE.Texture>(t: T, u: number, v = u): T => {
  t.repeat.set(u, v);
  return t;
};

/**
 * Materials for the followed car. Paint is a clear coat over a metallic
 * base with flake normals; carbon has a twill weave with highlights that
 * streak along the fibers; glass is dark and almost mirror smooth. Lower
 * tiers drop the texture detail they would not show anyway.
 */
export function createHeroMaterials(tier: QualityTier): HeroMaterials {
  const high = tier === 'high';
  const textures: THREE.Texture[] = [];
  const keep = <T extends THREE.Texture>(t: T) => (textures.push(t), t);

  const paint = new THREE.MeshPhysicalMaterial({ color: PARKED_PAINT, metalness: 0.2, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.03 });
  if (tier !== 'low') {
    // UVs are in meters, so ten repeats make each flake about a millimeter across.
    paint.normalMap = keep(repeat(flakeNormalMap(high ? 512 : 256), high ? 10 : 6));
    paint.normalScale.set(0.55, 0.55);
  }

  // Maps are built only for the tiers that use them: Low skips the normals, and only High has fiber highlights.
  const weave = high ? 512 : 256;
  const carbon = new THREE.MeshPhysicalMaterial({ map: keep(repeat(carbonColor(weave), 16)), roughness: 0.5, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 });
  if (tier !== 'low') {
    carbon.normalMap = keep(repeat(carbonNormal(weave), 16));
    carbon.normalScale.set(0.3, 0.3);
  }
  if (high) {
    carbon.anisotropy = 0.55;
    carbon.anisotropyMap = keep(repeat(carbonFibers(weave), 16));
  }

  const mesh = <T extends THREE.Texture>(t: T) => keep(repeat(t, 8, 8 * HONEYCOMB_ASPECT));
  const grille = new THREE.MeshStandardMaterial({ map: mesh(honeycombColor(128)), normalMap: tier === 'low' ? null : mesh(honeycombNormal(128)), roughness: 0.55, metalness: 0.35 });

  const disc = new THREE.MeshStandardMaterial({ map: keep(repeat(discMap(128), DISC_REPEAT, 1)), roughness: 0.55, metalness: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: '#2a0303', emissive: '#ff1a10', emissiveIntensity: TAIL_GLOW.idle, roughness: 0.3, toneMapped: false });

  const slots: Record<Slot, THREE.Material> = {
    paint,
    carbon,
    grille,
    disc,
    tail,
    glass: new THREE.MeshPhysicalMaterial({ color: '#06080b', metalness: 0, roughness: 0.04 }),
    trim: new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.55, metalness: 0.15 }),
    gold: new THREE.MeshPhysicalMaterial({ color: '#d6a45c', metalness: 1, roughness: 0.24, clearcoat: 0.6 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.7), toneMapped: false }),
    liner: new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c9cdd3', metalness: 1, roughness: 0.18 }),
    tire: new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.86 }),
    rim: new THREE.MeshStandardMaterial({ color: '#0f1013', metalness: 0.55, roughness: 0.42 }),
    caliper: new THREE.MeshPhysicalMaterial({ color: '#e2a527', roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 }),
  };
  for (const [slot, k] of Object.entries(REFLECT)) (slots[slot as Slot] as THREE.MeshStandardMaterial).envMapIntensity = k;
  return {
    slots,
    paint,
    tail,
    dispose: () => {
      Object.values(slots).forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
