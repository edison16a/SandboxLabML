'use client';

import * as THREE from 'three';
import { useDisposable } from '@/render/shared/useDisposable';
import { detailTier, type DrivingTier } from '../quality';
import { WHEEL, WHEEL_SPOTS } from './dimensions';
import { buildBody } from './geometry/assemble';
import { DETAIL, type Slot } from './geometry/parts';
import { buildWheel, caliper } from './geometry/wheels';
import type { SuvMaterials } from './materials/suvMaterials';

/** Slots too thin or small to cast a useful shadow. */
const NO_SHADOW = new Set<Slot>(['led', 'tail', 'grille', 'liner', 'metal', 'caliper', 'disc', 'trim']);

/** Handles the driver animates: the sprung body, each wheel's steering pivot and its spinning part. */
export interface SuvRig {
  body: React.RefObject<THREE.Group | null>;
  steer: React.RefObject<Array<THREE.Group | null>>;
  spin: React.RefObject<Array<THREE.Group | null>>;
}

interface SuvGeometry {
  body: Array<[Slot, THREE.BufferGeometry]>;
  wheel: Array<[Slot, THREE.BufferGeometry]>;
  caliper: THREE.BufferGeometry;
  blur: THREE.BufferGeometry;
}

/** Built geometry by detail level: the design never changes, so a step back to a level seen before skips the build. */
const built = new Map<string, SuvGeometry>();

function suvGeometry(level: 'low' | 'medium' | 'high'): SuvGeometry {
  let geo = built.get(level);
  if (!geo) {
    const d = DETAIL[level];
    geo = { body: [...buildBody(d)], wheel: [...buildWheel(d)], caliper: caliper(d), blur: new THREE.CircleGeometry(WHEEL.rim - 0.004, 40) };
    built.set(level, geo);
  }
  return geo;
}

const BLUR_Z = WHEEL.width / 2 - 0.006;

/**
 * The full detail SUV: the body by material slot, and four wheels with
 * spokes, discs and calipers. Left wheels are mirrored so their faces
 * point out.
 */
export function SuvModel({ tier, materials, rig }: { tier: DrivingTier; materials: SuvMaterials; rig?: SuvRig }) {
  const level = detailTier(tier);
  const geo = useDisposable(() => {
    const g = suvGeometry(level);
    const all = [...g.body, ...g.wheel].map(([, part]) => part).concat(g.caliper, g.blur);
    return { ...g, dispose: () => all.forEach((part) => part.dispose()) };
  }, [level]);
  return (
    <>
      <group ref={rig?.body}>
        {geo.body.map(([slot, g]) => (
          <mesh key={slot} geometry={g} material={materials.slots[slot]} castShadow={!NO_SHADOW.has(slot)} receiveShadow />
        ))}
      </group>
      {WHEEL_SPOTS.map(([x, z], i) => (
        <group key={i} position={[x, WHEEL.radius, z]} ref={(el) => void (rig && (rig.steer.current[i] = el))}>
          <group scale={[1, 1, z < 0 ? -1 : 1]}>
            <group ref={(el) => void (rig && (rig.spin.current[i] = el))}>
              {geo.wheel.map(([slot, g]) => (
                <mesh key={slot} geometry={g} material={materials.slots[slot]} castShadow={slot === 'tire'} receiveShadow />
              ))}
            </group>
            <mesh geometry={geo.caliper} material={materials.slots.caliper} />
            <mesh geometry={geo.blur} material={materials.blur} position-z={BLUR_Z} renderOrder={2} />
          </group>
        </group>
      ))}
    </>
  );
}
