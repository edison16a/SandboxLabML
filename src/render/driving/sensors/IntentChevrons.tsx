'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { SUV_SIZE } from '@/engine/driving/car/params';
import { useDisposable } from '@/render/shared/useDisposable';
import { FRAME_PRIORITY } from '../frame/FrameDriver';
import { useDrivingScene } from '../frame/sceneContext';
import { alignToRoute } from './intentAlign';
import { chevronGeometry, predictPath, type PredictFrom, type Prediction } from './intentPath';
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
 * Time constants the steering and the pedal are eased with, s. A brain
 * steers in small saturated corrections; forecast from one tick's wheel
 * the arrows would swing with each one, eased over about a second they
 * follow the line the car is really taking. The pedal sets the color, so
 * it follows the HUD closely and only skips single tick flickers.
 */
const STEER_EASE = 1;
const PEDAL_EASE = 0.12;
/** Pedal past which the arrows read as accelerating or braking rather than coasting. */
const DEAD_BAND = 0.1;

/**
 * Where the followed SUV is about to go: the same bicycle model the
 * simulation uses, run forward from its pose on its eased steering and
 * pedal, then leaned onto its lane ahead (see alignToRoute), with a
 * chevron every 3.8 m of road. Green when it is accelerating, pale blue
 * when coasting, red when braking, from the same pedal the HUD shows.
 * Each arrow is a bright core over a dark, softly blended backing, so it
 * reads on sunlit asphalt as well as in shade.
 */
export function IntentChevrons() {
  const { frame, car, route } = useDrivingScene();
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
  /** The eased controls the forecast runs on, and which car and episode they belong to. */
  const eased = useMemo(() => ({ from: { pos: { x: 0, z: 0 }, yaw: 0, speed: 0, steer: 0, pedal: 0 } as PredictFrom, focus: -1, epoch: -1, route: null as unknown, car: { x: 0, y: 0, index: -1 } }), []);

  useFrame((_, dt) => {
    const g = core.current;
    const b = back.current;
    if (!g || !b) return;
    if (frame.focus < 0 || frame.status !== 0) {
      g.count = 0;
      b.count = 0;
      return;
    }
    const e = eased.from;
    if (eased.focus !== frame.focus || eased.epoch !== frame.epoch) {
      // Another car or a fresh start: begin from its own controls, not a glide from the last car's.
      eased.focus = frame.focus;
      eased.epoch = frame.epoch;
      eased.car.index = -1;
      e.steer = frame.steer;
      e.pedal = frame.pedal;
    }
    const step = Math.min(dt, 0.25);
    e.steer += (frame.steer - e.steer) * (1 - Math.exp(-step / STEER_EASE));
    e.pedal += (frame.pedal - e.pedal) * (1 - Math.exp(-step / PEDAL_EASE));
    e.pos.x = frame.pos.x;
    e.pos.z = frame.pos.z;
    e.yaw = frame.yaw;
    e.speed = frame.speed;
    const pedal = e.pedal;
    predictPath(e, car, FIRST, SPACING, COUNT, tmp.path);
    if (route) {
      const at = eased.car;
      // A new route means a new search from scratch.
      if (eased.route !== route) at.index = -1;
      eased.route = route;
      at.x = frame.pos.x;
      at.y = -frame.pos.z;
      alignToRoute(tmp.path, route.path, at, route.destS, FIRST, SPACING, COUNT);
    }
    const color = pedal > DEAD_BAND ? SENSOR.accelerate : pedal < -DEAD_BAND ? SENSOR.brake : SENSOR.coast;
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
