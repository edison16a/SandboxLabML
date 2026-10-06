'use client';

import type * as THREE from 'three';
import type { QualityTier } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { CAR, WHEEL_SPOTS } from './dimensions';
import { buildBody } from './geometry/assemble';
import { DETAIL, type Slot } from './geometry/parts';
import { buildWheel, caliper } from './geometry/wheels';
import type { HeroMaterials } from './materials/heroMaterials';

/** Slots too thin or too small to cast a useful shadow. Skipping them saves shadow work and avoids acne on the paint. */
const NO_SHADOW = new Set<Slot>(['gold', 'led', 'tail', 'grille', 'liner', 'metal', 'caliper', 'disc']);

/** Handles the driver animates: the sprung body, each wheel's steering pivot and its spinning part. */
export interface HeroRig {
  body: React.RefObject<THREE.Group | null>;
  steer: React.RefObject<Array<THREE.Group | null>>;
  spin: React.RefObject<Array<THREE.Group | null>>;
}

interface Props {
  tier: QualityTier;
  materials: HeroMaterials;
  rig?: HeroRig;
}

interface HeroGeometry {
  body: Array<[Slot, THREE.BufferGeometry]>;
  wheel: Array<[Slot, THREE.BufferGeometry]>;
  caliper: THREE.BufferGeometry;
}

/**
 * Built geometry by tier. The design never changes, so a quality step back
 * to a tier seen before skips the build. Leaving a tier frees only the GPU
 * copies, and three uploads them again if the tier comes back.
 */
const built = new Map<QualityTier, HeroGeometry>();

function heroGeometry(tier: QualityTier): HeroGeometry {
  let geo = built.get(tier);
  if (!geo) {
    geo = { body: [...buildBody(DETAIL[tier])], wheel: [...buildWheel(DETAIL[tier])], caliper: caliper(DETAIL[tier]) };
    built.set(tier, geo);
  }
  return geo;
}

/**
 * The full detail car: the body by material slot, and four wheels with
 * spokes, brake discs and calipers. Wheels on the left are mirrored so
 * their faces point out.
 */
export function HeroCar({ tier, materials, rig }: Props) {
  const geo = useDisposable(() => {
    const g = heroGeometry(tier);
    const all = [...g.body, ...g.wheel].map(([, part]) => part).concat(g.caliper);
    return { ...g, dispose: () => all.forEach((part) => part.dispose()) };
  }, [tier]);

  return (
    <>
      <group ref={rig?.body}>
        {geo.body.map(([slot, g]) => (
          <mesh key={slot} geometry={g} material={materials.slots[slot]} castShadow={!NO_SHADOW.has(slot)} receiveShadow />
        ))}
      </group>
      {WHEEL_SPOTS.map(([x, z], i) => (
        <group key={i} position={[x, CAR.wheelRadius, z]} ref={(el) => void (rig && (rig.steer.current[i] = el))}>
          <group scale={[1, 1, z < 0 ? -1 : 1]}>
            <group ref={(el) => void (rig && (rig.spin.current[i] = el))}>
              {geo.wheel.map(([slot, g]) => (
                <mesh key={slot} geometry={g} material={materials.slots[slot]} castShadow={slot === 'tire'} receiveShadow />
              ))}
            </group>
            <mesh geometry={geo.caliper} material={materials.slots.caliper} />
          </group>
        </group>
      ))}
    </>
  );
}
