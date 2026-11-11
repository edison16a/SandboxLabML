'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { createCar, stepCar } from '@/engine/driving/car/dynamics';
import { SIM_DT } from '@/engine/driving/car/params';
import { useDisposable } from '@/render/shared/useDisposable';
import { FRAME_PRIORITY } from '../frame/FrameDriver';
import { useDrivingScene } from '../frame/sceneContext';
import { SENSOR } from './palette';

/** Chevrons drawn, the time between them, s, and how far ahead the first one sits. */
const COUNT = 8;
const SPACING = 0.32;

/** A flat chevron pointing +x, about a lane's width across. */
function chevronGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const w = 0.62;
  const t = 0.2;
  const d = 0.42;
  shape.moveTo(0, 0);
  shape.lineTo(-d, w);
  shape.lineTo(-d - t, w);
  shape.lineTo(-t, 0);
  shape.lineTo(-d - t, -w);
  shape.lineTo(-d, -w);
  shape.closePath();
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0.3, 0.045, 0);
}

/**
 * Where the followed SUV will be over the next two and a half seconds if
 * it keeps its current steering and pedal: the same bicycle model the
 * simulation uses, run forward from its pose, with a chevron every third
 * of a second. Green when it is accelerating, pale blue when coasting,
 * red when braking, each fainter the further ahead it is.
 */
export function IntentChevrons() {
  const { frame, car } = useDrivingScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const built = useDisposable(() => {
    const geometry = chevronGeometry();
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    return { geometry, material, dispose: () => (geometry.dispose(), material.dispose()) };
  }, []);
  const tmp = useMemo(() => ({ state: createCar(0, 0, 0), m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color(), up: new THREE.Vector3(0, 1, 0) }), []);

  useFrame(() => {
    const g = mesh.current;
    if (!g) return;
    if (frame.focus < 0 || frame.status !== 0) {
      g.count = 0;
      return;
    }
    // The snapshot holds the wheel angle; undo the speed fade to get the command that produced it.
    const st = tmp.state;
    const fade = frame.speed / car.steerFadeSpeed;
    st.x = frame.pos.x;
    st.y = -frame.pos.z;
    st.heading = frame.yaw;
    st.speed = frame.speed;
    st.steer = frame.steer;
    const steerCmd = Math.max(-1, Math.min(1, (frame.steer * (1 + fade * fade)) / car.steerMax));
    const pedal = frame.pedal;
    const color = pedal > 0.08 ? SENSOR.accelerate : pedal < -0.08 ? SENSOR.brake : SENSOR.coast;
    let shown = 0;
    let t = 0;
    let lastX = st.x;
    let lastY = st.y;
    for (let k = 0; k < COUNT; k++) {
      const until = SPACING * (k + 1.4);
      while (t < until) {
        stepCar(st, steerCmd, pedal, car);
        t += SIM_DT;
      }
      // Chevrons bunch up as the car slows to a stop; drop any that would overlap the last one.
      if (Math.hypot(st.x - lastX, st.y - lastY) < 0.9) continue;
      lastX = st.x;
      lastY = st.y;
      tmp.m.compose(tmp.p.set(st.x, 0, -st.y), tmp.q.setFromAxisAngle(tmp.up, st.heading), tmp.s);
      g.setMatrixAt(shown, tmp.m);
      g.setColorAt(shown, tmp.c.copy(color).multiplyScalar(0.85 * (1 - k / (COUNT + 1))));
      shown++;
    }
    g.count = shown;
    g.instanceMatrix.needsUpdate = true;
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
  }, FRAME_PRIORITY.overlay);

  return <instancedMesh ref={mesh} args={[built.geometry, built.material, COUNT]} renderOrder={5} frustumCulled={false} />;
}
