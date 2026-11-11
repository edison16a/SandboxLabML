'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { STATUS_ARRIVED } from '@/engine/driving/agent/learner';
import { LF_BRAKE } from '@/engine/driving/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { useDrivingScene } from '../frame/sceneContext';
import { bodyMotion, FLAT_ROAD, stepBody } from '../motion/bodyModel';
import { paintColor } from '../population/palette';
import { smoothstep } from '../textures/noise';
import { ContactShadow } from './ContactShadow';
import { BODY, WHEEL, WHEEL_SPOTS } from './dimensions';
import { createSuvMaterials, PARKED_PAINT, TAIL_GLOW } from './materials/suvMaterials';
import { useCarReflections } from './materials/useCarReflections';
import { SuvModel, type SuvRig } from './SuvModel';

/** Height the body pitches and rolls about, m: roughly an SUV's center of mass. */
const PIVOT = 0.62;
/** Largest wheel turn drawn per frame: under half the angle between two of the ten spoke arms. */
const MAX_TURN = ((Math.PI * 2) / 10) * 0.45;

/**
 * The full detail SUV for whichever learner the camera follows. The body
 * rides on springs driven by the simulation's real accelerations: it dives
 * under braking, squats pulling away and leans out of turns. Wheels steer
 * with the real wheel angle and roll at true road speed; spokes blur past
 * walking pace. The rear light bar flares when it brakes. Each species
 * has its own paint from a set of real automotive colors.
 */
export function FollowedSuv() {
  const { population, frame, tier } = useDrivingScene();
  const root = useRef<THREE.Group>(null);
  const rig: SuvRig = { body: useRef<THREE.Group>(null), steer: useRef<Array<THREE.Group | null>>([]), spin: useRef<Array<THREE.Group | null>>([]) };
  const state = useMemo(() => ({ body: bodyMotion(), spin: new Float32Array(4), color: new THREE.Color(PARKED_PAINT), euler: new THREE.Euler(), pivot: new THREE.Vector3() }), []);
  const materials = useDisposable(() => {
    const m = createSuvMaterials(tier);
    m.paint.color.copy(state.color);
    return m;
  }, [tier]);
  useCarReflections([...Object.values(materials.slots), materials.blur]);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    if (frame.focus < 0 || !population?.curr) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const step = Math.min(dt, 0.1);
    const speed = frame.speed;
    const b = state.body;
    stepBody(b, frame.motion, speed, FLAT_ROAD, step, BODY.track * 2, BODY.axleFront - BODY.axleRear);
    g.position.copy(frame.pos);
    g.rotation.set(0, frame.yaw, 0);
    const body = rig.body.current;
    if (body) {
      // Taller than the racer: it leans a touch more, about its own center of mass.
      state.euler.set(b.roll.x * 1.6, 0, b.pitch.x * 1.4);
      body.rotation.copy(state.euler);
      state.pivot.set(0, PIVOT, 0).applyEuler(state.euler);
      body.position.set(-state.pivot.x, PIVOT - state.pivot.y + b.heave.x, -state.pivot.z);
    }
    const yawRate = frame.motion.yawRate;
    for (let i = 0; i < 4; i++) {
      const [, z] = WHEEL_SPOTS[i];
      const pivot = rig.steer.current[i];
      if (pivot) pivot.rotation.set(0, i < 2 ? frame.steer : 0, 0);
      const turn = ((speed + yawRate * z) * step) / WHEEL.radius;
      state.spin[i] -= Math.sign(turn) * Math.min(Math.abs(turn), MAX_TURN);
      const spinner = rig.spin.current[i];
      if (spinner) spinner.rotation.z = state.spin[i];
    }
    const revs = Math.abs(speed) / (Math.PI * 2 * WHEEL.radius);
    materials.blur.opacity = 0.9 * smoothstep(3.2, 6, revs);
    materials.tail.emissiveIntensity = frame.flags & LF_BRAKE ? TAIL_GLOW.brake : TAIL_GLOW.idle;
    paintColor(population.tags[frame.focus] ?? 0, state.color);
    if (frame.status === STATUS_ARRIVED) state.color.offsetHSL(0, 0, 0.04);
    materials.paint.color.lerp(state.color, 0.15);
  });

  return (
    <group ref={root} visible={false}>
      <SuvModel tier={tier} materials={materials} rig={rig} />
      <ContactShadow />
    </group>
  );
}
