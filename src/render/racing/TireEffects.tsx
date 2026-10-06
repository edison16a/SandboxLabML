'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { GRAVITY, DEFAULT_CAR } from '@/engine/racing/car/params';
import { attachOpacity, createFadeMaterial } from '@/render/shared/fadeMaterial';
import { useDisposable } from '@/render/shared/useDisposable';
import { CAR } from './car/dimensions';
import { useRacingScene } from './sceneContext';

const MARKS = 600;
const PUFFS = 48;
const MARK_LIFE = 12;
const PUFF_LIFE = 1.4;

/**
 * Skid marks and tire smoke for the followed car. They appear when the car
 * pulls close to the grip limit or brakes hard at speed, which is exactly
 * when the brain is pushing the car. Purely cosmetic and computed from the
 * snapshot motion, never from the simulation.
 */
export function TireEffects() {
  const { frame } = useRacingScene();
  const marks = useRef<THREE.InstancedMesh>(null);
  const puffs = useRef<THREE.InstancedMesh>(null);
  const built = useDisposable(() => {
    const markGeo = new THREE.PlaneGeometry(0.62, 0.26).rotateX(-Math.PI / 2);
    const markOpacity = attachOpacity(markGeo, MARKS);
    const puffGeo = new THREE.IcosahedronGeometry(0.5, 1);
    const puffOpacity = attachOpacity(puffGeo, PUFFS);
    const markMat = createFadeMaterial({ color: '#141414', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
    const puffMat = createFadeMaterial({ color: '#e9ecef', roughness: 1 });
    return { markGeo, markOpacity, puffGeo, puffOpacity, markMat, puffMat, dispose: () => [markGeo, puffGeo, markMat, puffMat].forEach((d) => d.dispose()) };
  }, []);
  const s = useMemo(
    () => ({ markAge: new Float32Array(MARKS).fill(99), puffAge: new Float32Array(PUFFS).fill(99), puffPos: new Float32Array(PUFFS * 3), nextMark: 0, nextPuff: 0, lastYaw: 0, lastSpeed: 0, m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), sc: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1) || 0.016;
    const yawRate = (frame.focusYaw - s.lastYaw) / dt;
    const decel = (s.lastSpeed - frame.focusSpeed) / dt;
    s.lastYaw = frame.focusYaw;
    s.lastSpeed = frame.focusSpeed;
    const lateral = Math.abs(yawRate) < 6 ? Math.abs(frame.focusSpeed * yawRate) : 0;
    const limit = DEFAULT_CAR.grip * GRAVITY;
    const skidding = frame.focusIndex >= 0 && frame.focusSpeed > 6 && (lateral > 0.82 * limit || decel > 0.85 * DEFAULT_CAR.brake);

    if (skidding) {
      const yaw = frame.focusYaw;
      const fx = Math.cos(yaw);
      const fz = -Math.sin(yaw);
      for (const side of [1, -1]) {
        const i = s.nextMark;
        s.nextMark = (i + 1) % MARKS;
        s.markAge[i] = 0;
        const wx = frame.focusPos.x + fx * CAR.axleRear + Math.sin(yaw) * side * CAR.track;
        const wz = frame.focusPos.z + fz * CAR.axleRear + Math.cos(yaw) * side * CAR.track;
        s.q.setFromAxisAngle(s.up, yaw);
        s.m.compose(s.p.set(wx, 0.035, wz), s.q, s.sc.set(1, 1, 1));
        marks.current?.setMatrixAt(i, s.m);
        if (side === 1 && Math.random() < 0.5) {
          const k = s.nextPuff;
          s.nextPuff = (k + 1) % PUFFS;
          s.puffAge[k] = 0;
          s.puffPos.set([wx, 0.4, wz], k * 3);
        }
      }
    }
    for (let i = 0; i < MARKS; i++) {
      s.markAge[i] += dt;
      built.markOpacity.setX(i, Math.max(0, 0.55 * (1 - s.markAge[i] / MARK_LIFE)));
    }
    for (let k = 0; k < PUFFS; k++) {
      s.puffAge[k] += dt;
      const t = s.puffAge[k] / PUFF_LIFE;
      const scale = t < 1 ? 0.6 + t * 2.2 : 0;
      s.m.compose(s.p.set(s.puffPos[k * 3], s.puffPos[k * 3 + 1] + t * 1.2, s.puffPos[k * 3 + 2]), s.q.identity(), s.sc.setScalar(scale));
      puffs.current?.setMatrixAt(k, s.m);
      built.puffOpacity.setX(k, t < 1 ? 0.32 * (1 - t) : 0);
    }
    if (marks.current) marks.current.instanceMatrix.needsUpdate = true;
    if (puffs.current) puffs.current.instanceMatrix.needsUpdate = true;
    built.markOpacity.needsUpdate = true;
    built.puffOpacity.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={marks} args={[built.markGeo, built.markMat, MARKS]} frustumCulled={false} receiveShadow />
      <instancedMesh ref={puffs} args={[built.puffGeo, built.puffMat, PUFFS]} frustumCulled={false} renderOrder={3} />
    </group>
  );
}
