'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { springStep } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { ContactShadow } from './car/ContactShadow';
import { CAR } from './car/dimensions';
import { HeroCar, type HeroRig } from './car/HeroCar';
import { createHeroMaterials, TAIL_GLOW } from './car/materials/heroMaterials';
import { useCarReflections } from './car/materials/useCarReflections';
import { ghostColor, speciesColor } from './palette';
import { useRacingScene } from './sceneContext';

const STRIDE = RACING_SNAPSHOT.stride;

/**
 * The full detail car for whichever car the camera follows: clear coated
 * paint, steerable front wheels, spinning wheels, tail lamps that flare
 * under braking and body roll and pitch from a spring on the car's
 * accelerations.
 */
export function ChampionCar() {
  const { population, ghosts, frame } = useRacingScene();
  const tier = useRacingLab((s) => s.activeTier);
  const root = useRef<THREE.Group>(null);
  const rig: HeroRig = { body: useRef<THREE.Group>(null), steer: useRef<Array<THREE.Group | null>>([]), spin: useRef<Array<THREE.Group | null>>([]) };
  const materials = useDisposable(() => createHeroMaterials(tier), [tier]);
  const state = useMemo(() => ({ roll: 0, rollV: 0, pitch: 0, pitchV: 0, spin: 0, lastSpeed: 0, lastYaw: 0, color: new THREE.Color() }), []);
  useCarReflections(Object.values(materials.slots));

  useFrame((_, dt) => {
    const g = root.current;
    const stream = frame.focusStream === 'ghosts' ? ghosts : population;
    if (!g) return;
    if (!stream?.curr || frame.focusIndex < 0) {
      // Before the first generation, park the car on the start line so the idle scene has a subject.
      const idle = !population?.curr && !ghosts?.curr;
      g.visible = idle;
      if (idle) {
        g.position.copy(frame.focusPos);
        g.rotation.set(0, frame.focusYaw, 0);
      }
      return;
    }
    g.visible = true;
    const o = frame.focusIndex * STRIDE;
    const buf = stream.curr.buffer;
    const steer = buf[o + 4];
    const pedal = buf[o + 5];
    const speed = frame.focusSpeed;
    g.position.copy(frame.focusPos);
    g.rotation.set(0, frame.focusYaw, 0);

    const step = Math.min(dt, 0.05) || 0.016;
    const accel = (speed - state.lastSpeed) / step;
    const yawRate = (frame.focusYaw - state.lastYaw) / step;
    state.lastSpeed = speed;
    state.lastYaw = frame.focusYaw;
    const lateral = Number.isFinite(yawRate) && Math.abs(yawRate) < 6 ? speed * yawRate : 0;
    [state.roll, state.rollV] = springStep(state.roll, state.rollV, THREE.MathUtils.clamp(-lateral * 0.006, -0.07, 0.07), 9, step);
    [state.pitch, state.pitchV] = springStep(state.pitch, state.pitchV, THREE.MathUtils.clamp(accel * 0.004, -0.05, 0.05), 9, step);
    rig.body.current?.rotation.set(state.roll, 0, state.pitch);

    state.spin -= (speed * step) / CAR.wheelRadius;
    for (let i = 0; i < 4; i++) {
      rig.steer.current[i]?.rotation.set(0, i < 2 ? steer : 0, 0);
      // A spin about the axle reads the same through the left wheels' mirror, so all four share it.
      const spinner = rig.spin.current[i];
      if (spinner) spinner.rotation.z = state.spin;
    }
    materials.tail.emissiveIntensity = pedal < -0.1 ? TAIL_GLOW.brake : TAIL_GLOW.idle;
    if (stream === ghosts) ghostColor(1, state.color);
    else speciesColor(stream.tags[frame.focusIndex] ?? 0, state.color);
    materials.paint.color.lerp(state.color, 0.2);
  });

  return (
    <group ref={root} visible={false}>
      <HeroCar tier={tier} materials={materials} rig={rig} />
      <ContactShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[3.0, 3.1, 64]} />
        <meshBasicMaterial color="#4c9aff" transparent opacity={0.4} toneMapped={false} />
      </mesh>
    </group>
  );
}
