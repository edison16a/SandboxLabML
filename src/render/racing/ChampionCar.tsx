'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { springStep } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { bodyGeometry, cabinGeometry, CAR, lightGeometry, spoilerGeometry, trimGeometry } from './carGeometry';
import { rimGeometry, tireGeometry } from './wheelGeometry';
import { ghostColor, speciesColor } from './palette';
import { useRacingScene } from './sceneContext';

const STRIDE = RACING_SNAPSHOT.stride;

/**
 * The full-detail car for whichever car the camera follows: clear-coated
 * paint, steerable front wheels, spinning wheels, glowing brake lights and
 * body roll and pitch from a spring on the car's accelerations.
 */
export function ChampionCar() {
  const { population, ghosts, frame } = useRacingScene();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wheels = useRef<Array<THREE.Group | null>>([]);
  const geo = useDisposable(() => {
    const g = { body: bodyGeometry(), cabin: cabinGeometry(), trim: trimGeometry(), spoiler: spoilerGeometry(), tire: tireGeometry(), rim: rimGeometry(), tail: lightGeometry(false), head: lightGeometry(true) };
    return { ...g, dispose: () => Object.values(g).forEach((x) => x.dispose()) };
  }, []);
  const paint = useDisposable(() => new THREE.MeshPhysicalMaterial({ color: '#4c9aff', metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }), []);
  const brake = useDisposable(() => new THREE.MeshStandardMaterial({ color: '#ff2a1f', emissive: '#ff1a10', emissiveIntensity: 0.4, toneMapped: false }), []);
  const state = useMemo(() => ({ roll: 0, rollV: 0, pitch: 0, pitchV: 0, spin: 0, lastSpeed: 0, lastYaw: 0, color: new THREE.Color() }), []);

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
    if (body.current) body.current.rotation.set(state.roll, 0, state.pitch);

    state.spin -= (speed * step) / CAR.wheelRadius;
    wheels.current.forEach((w, i) => {
      if (!w) return;
      w.rotation.set(0, i < 2 ? steer : 0, 0);
      const tire = w.children[0];
      if (tire) tire.rotation.z = state.spin;
    });
    brake.emissiveIntensity = pedal < -0.1 ? 5 : 0.35;
    if (stream === ghosts) ghostColor(1, state.color);
    else speciesColor(stream.tags[frame.focusIndex] ?? 0, state.color);
    paint.color.lerp(state.color, 0.2);
  });

  const wheelSpots: Array<[number, number]> = [
    [CAR.axleFront, CAR.track],
    [CAR.axleFront, -CAR.track],
    [CAR.axleRear, CAR.track],
    [CAR.axleRear, -CAR.track],
  ];

  return (
    <group ref={root} visible={false}>
      <group ref={body}>
        <mesh geometry={geo.body} material={paint} castShadow receiveShadow />
        <mesh geometry={geo.cabin} castShadow>
          <meshPhysicalMaterial color="#0b111a" metalness={0.2} roughness={0.05} clearcoat={1} />
        </mesh>
        <mesh geometry={geo.trim} castShadow>
          <meshStandardMaterial color="#121418" roughness={0.55} metalness={0.2} />
        </mesh>
        <mesh geometry={geo.spoiler} castShadow>
          <meshStandardMaterial color="#14161b" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh geometry={geo.tail} material={brake} />
        <mesh geometry={geo.head}>
          <meshStandardMaterial color="#fffbe8" emissive="#fff4d2" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </group>
      {wheelSpots.map(([x, z], i) => (
        <group key={i} position={[x, CAR.wheelRadius, z]} ref={(el) => void (wheels.current[i] = el)}>
          {/* Wheels on the far side are mirrored so their spokes face out. */}
          <group scale={[1, 1, z < 0 ? -1 : 1]}>
            <mesh geometry={geo.tire} castShadow>
              <meshStandardMaterial color="#141518" roughness={0.88} />
            </mesh>
            <mesh geometry={geo.rim}>
              <meshStandardMaterial color="#b9bec6" metalness={0.9} roughness={0.25} />
            </mesh>
          </group>
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[3.0, 3.1, 64]} />
        <meshBasicMaterial color="#4c9aff" transparent opacity={0.4} toneMapped={false} />
      </mesh>
    </group>
  );
}
