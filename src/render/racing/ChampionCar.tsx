'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab, type QualityTier } from '@/features/racing/state/labStore';
import { blendField } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { ContactShadow } from './car/ContactShadow';
import { CAR, WHEEL_SPOTS } from './car/dimensions';
import { HeroCar, type HeroRig } from './car/HeroCar';
import { createHeroMaterials, PARKED_PAINT, TAIL_GLOW } from './car/materials/heroMaterials';
import { useCarReflections } from './car/materials/useCarReflections';
import { bodyMotion, FLAT_ROAD, stepBody } from './motion/bodyModel';
import { ghostColor, speciesColor } from './palette';
import { useRacingScene } from './sceneContext';

const STRIDE = RACING_SNAPSHOT.stride;
/** Height the body pitches and rolls about, m: roughly the car's center of mass. */
const PIVOT = 0.45;

/** Options for drawing the car outside the Racing lab, such as the landing hero. The lab passes none. */
interface ChampionCarProps {
  /** Draws at this tier instead of the Racing lab's, for a view outside the lab. */
  tier?: QualityTier;
  /** The blue ring that marks the followed car in the lab. A view with one car leaves it out. */
  ring?: boolean;
}

/**
 * The full detail car for whichever car the camera follows. The body rides
 * on springs driven by the simulation's real accelerations: it dives under
 * braking, squats under power, rolls out of bends and steps its tail out a
 * few degrees at the grip limit. Wheels stay planted, ride up over kerbs,
 * steer with the real wheel angle and spin at true road speed, the outside
 * pair a touch faster through a bend.
 */
export function ChampionCar({ tier: pinnedTier, ring = true }: ChampionCarProps) {
  const { population, ghosts, frame } = useRacingScene();
  const labTier = useRacingLab((s) => s.activeTier);
  const tier = pinnedTier ?? labTier;
  const root = useRef<THREE.Group>(null);
  const rig: HeroRig = { body: useRef<THREE.Group>(null), steer: useRef<Array<THREE.Group | null>>([]), spin: useRef<Array<THREE.Group | null>>([]) };
  const state = useMemo(() => ({ body: bodyMotion(), spin: new Float32Array(4), color: new THREE.Color(PARKED_PAINT), euler: new THREE.Euler(), pivot: new THREE.Vector3() }), []);
  // A tier change rebuilds the materials. Start the new paint at the current target so the car does not flash the parked color.
  const materials = useDisposable(() => {
    const m = createHeroMaterials(tier);
    m.paint.color.copy(state.color);
    return m;
  }, [tier]);
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
    const step = Math.min(dt, 0.1);
    const o = frame.focusIndex * STRIDE;
    const buf = stream.curr.buffer;
    const prev = stream.prev?.buffer ?? null;
    const steer = blendField(prev, buf, o + 4, stream.alpha());
    const speed = frame.focusSpeed;
    const contact = frame.contact;
    const b = state.body;
    stepBody(b, frame.motion, speed, speed > 0.5 ? contact.road : FLAT_ROAD, step);
    g.position.copy(frame.focusPos);
    g.rotation.set(0, frame.focusYaw + b.slip.x, 0);

    // Rotate the body about its center of mass, not the ground: shift it by what that rotation moves the pivot.
    const body = rig.body.current;
    if (body) {
      state.euler.set(b.roll.x, 0, b.pitch.x);
      body.rotation.copy(state.euler);
      state.pivot.set(0, PIVOT, 0).applyEuler(state.euler);
      body.position.set(-state.pivot.x, PIVOT - state.pivot.y + b.heave.x, -state.pivot.z);
    }
    const yawRate = frame.motion.yawRate;
    for (let i = 0; i < 4; i++) {
      const [, z] = WHEEL_SPOTS[i];
      const pivot = rig.steer.current[i];
      if (pivot) {
        pivot.rotation.set(0, i < 2 ? steer : 0, 0);
        pivot.position.y = CAR.wheelRadius + contact.lift[i];
      }
      // Each wheel rolls at its own ground speed: in a left turn the right side (positive z) covers more road.
      state.spin[i] -= ((speed + yawRate * z) * step) / CAR.wheelRadius;
      const spinner = rig.spin.current[i];
      // A spin about the axle reads the same through the left wheels' mirror, so all four use the same sign.
      if (spinner) spinner.rotation.z = state.spin[i];
    }
    materials.tail.emissiveIntensity = buf[o + 5] < -0.1 ? TAIL_GLOW.brake : TAIL_GLOW.idle;
    if (stream === ghosts) ghostColor(1, state.color);
    else speciesColor(stream.tags[frame.focusIndex] ?? 0, state.color);
    materials.paint.color.lerp(state.color, 0.2);
  });

  return (
    <group ref={root} visible={false}>
      <HeroCar tier={tier} materials={materials} rig={rig} />
      <ContactShadow />
      {ring && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[3.0, 3.1, 64]} />
          <meshBasicMaterial color="#4c9aff" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
