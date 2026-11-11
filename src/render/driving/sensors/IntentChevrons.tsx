'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { SUV_SIZE } from '@/engine/driving/car/params';
import { useDisposable } from '@/render/shared/useDisposable';
import { FRAME_PRIORITY } from '../frame/FrameDriver';
import { useDrivingScene } from '../frame/sceneContext';
import { chevronGeometry, predictPath, type Prediction } from './intentPath';
import { SENSOR } from './palette';

/** Chevrons drawn, and the road distance between them, m. */
const COUNT = 7;
const SPACING = 3.8;
/** The first sits one car length past the front bumper, where the chase camera can see it. */
const FIRST = SUV_SIZE.length / 2 + SUV_SIZE.length;
/** Brightness of the nearest and the furthest chevron. */
const NEAR_ALPHA = 1;
const FAR_ALPHA = 0.45;

/**
 * Where the followed SUV will be over the next few seconds if it keeps
 * its current steering and pedal: the same bicycle model the simulation
 * uses, run forward from its pose, with a chevron every 3.8 m of road.
 * Green when it is accelerating, pale blue when coasting, red when
 * braking. Each arrow is a bright core over a dark, softly blended
 * backing, so it reads on sunlit asphalt as well as in shade.
 */
export function IntentChevrons() {
  const { frame, car } = useDrivingScene();
  const core = useRef<THREE.InstancedMesh>(null);
  const back = useRef<THREE.InstancedMesh>(null);
  const built = useDisposable(() => {
    const coreGeometry = chevronGeometry(0);
    const backGeometry = chevronGeometry(0.16);
    const coreMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
    const backMaterial = new THREE.MeshBasicMaterial({ color: '#04070c', transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    return {
      coreGeometry,
      backGeometry,
      coreMaterial,
      backMaterial,
      dispose: () => (coreGeometry.dispose(), backGeometry.dispose(), coreMaterial.dispose(), backMaterial.dispose()),
    };
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color(), up: new THREE.Vector3(0, 1, 0), path: { count: 0, x: new Float64Array(COUNT), y: new Float64Array(COUNT), heading: new Float64Array(COUNT) } as Prediction }), []);

  useFrame(() => {
    const g = core.current;
    const b = back.current;
    if (!g || !b) return;
    if (frame.focus < 0 || frame.status !== 0) {
      g.count = 0;
      b.count = 0;
      return;
    }
    const pedal = frame.pedal;
    predictPath(frame, car, FIRST, SPACING, COUNT, tmp.path);
    const color = pedal > 0.08 ? SENSOR.accelerate : pedal < -0.08 ? SENSOR.brake : SENSOR.coast;
    const n = tmp.path.count;
    for (let k = 0; k < n; k++) {
      tmp.m.compose(tmp.p.set(tmp.path.x[k], 0, -tmp.path.y[k]), tmp.q.setFromAxisAngle(tmp.up, tmp.path.heading[k]), tmp.s);
      g.setMatrixAt(k, tmp.m);
      b.setMatrixAt(k, tmp.m);
      const fade = NEAR_ALPHA + (FAR_ALPHA - NEAR_ALPHA) * (k / Math.max(1, COUNT - 1));
      g.setColorAt(k, tmp.c.copy(color).multiplyScalar(fade));
    }
    g.count = n;
    b.count = n;
    g.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
  }, FRAME_PRIORITY.overlay);

  return (
    <>
      <instancedMesh ref={back} args={[built.backGeometry, built.backMaterial, COUNT]} renderOrder={5} frustumCulled={false} />
      <instancedMesh ref={core} args={[built.coreGeometry, built.coreMaterial, COUNT]} renderOrder={6} frustumCulled={false} />
    </>
  );
}
