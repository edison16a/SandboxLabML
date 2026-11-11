'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { Flight } from '@/render/hideseek/camera/flight';
import { cityEdgeFrom, farPlane, hazeRange } from '@/render/hideseek/scene/haze';
import { OUTER_WALL } from '@/engine/navigation/course/types';
import { useNavScene } from '../frame/sceneContext';
import { NAV_CAMERAS, type NavCamera } from '../types';
import { FollowBest } from './followBest';
import { overviewShot, topShot } from './shots';

/** The camera never dips below this, m. */
const MIN_HEIGHT = 0.4;
/** How far past the course the orbit point may be panned, m. */
const PAN_MARGIN = 10;
/** Key of the free view, so leaving it always reframes the next view. */
const FREE = -1;

type Controls = React.ComponentRef<typeof OrbitControls>;

/**
 * Every camera view of the course. Overview and Top fly to a set shot of
 * the whole course whenever the view or the course changes; Follow trails
 * the best runner (see FollowBest); Free never moves by itself. Orbit, pan
 * and zoom work in every view, never under the floor or far off the course.
 */
export function NavCameraRig({ mode }: { mode: NavCamera }) {
  const { frame } = useNavScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useRef<Controls>(null);
  const r = useMemo(() => ({ flight: new Flight(), follow: new FollowBest(), target: { key: 0, x: 0, z: 0, epoch: 0, hx: 10, hz: 5 }, haze: { near: 0, far: 0 } }), []);
  const f = r.flight;

  useFrame((_, rawDt) => {
    const c = controls.current;
    const course = frame.course;
    if (!c || !course) return;
    const dt = Math.min(rawDt, 0.1);
    const key = NAV_CAMERAS.indexOf(mode) * 1e6 + frame.courseVersion;
    const aspect = size.width / Math.max(1, size.height);
    if (mode === 'follow' && frame.leader >= 0) {
      const t = r.target;
      t.key = key;
      t.x = frame.leaderPose.x;
      t.z = frame.leaderPose.z;
      t.epoch = frame.epoch;
      t.hx = course.halfLength;
      t.hz = course.halfWidth;
      r.follow.update(camera, c, f, t, dt, frame.timeScale);
      invalidate();
    } else if (mode !== 'free' && key + 0.5 !== f.key) {
      // Follow with nobody to follow shows the overview, under a key of its own so it flies to the runner once one turns up.
      f.key = key + 0.5;
      f.start(camera, c, mode === 'top' ? topShot(course, camera.fov, aspect) : overviewShot(course, camera.fov, aspect));
    } else if (mode === 'free' && f.key !== FREE) {
      // The free view stays wherever it is; opened before anything was framed, it starts on the overview.
      if (Number.isNaN(f.key)) f.start(camera, c, overviewShot(course, camera.fov, aspect));
      f.key = FREE;
    }
    if (f.t < 1) {
      // A flight runs on wall time up to a quarter second a frame, so it lands on time on a slow machine.
      f.step(camera, c, Math.min(rawDt, 0.25));
      invalidate();
    } else f.keepInBounds(camera, c, course.halfLength + PAN_MARGIN, course.halfWidth + PAN_MARGIN);
    if (camera.position.y < MIN_HEIGHT) camera.position.y = MIN_HEIGHT;
    fitDepth(camera, scene, c.target, course.halfLength + OUTER_WALL, course.halfWidth + OUTER_WALL, r.haze);
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      screenSpacePanning={false}
      zoomToCursor={mode === 'free'}
      maxPolarAngle={1.5}
      minDistance={2}
      maxDistance={260}
    />
  );
}

/**
 * Near and far planes and the haze follow the viewing distance, as in Hide
 * and Seek: depth precision stays on the course from any orbit, and the
 * city melts into the sky where it ends.
 */
function fitDepth(camera: THREE.PerspectiveCamera, scene: THREE.Scene, target: THREE.Vector3, hx: number, hz: number, haze: { near: number; far: number }): void {
  const distance = camera.position.distanceTo(target);
  const fog = scene.fog as THREE.Fog | null;
  if (fog) {
    hazeRange(distance, cityEdgeFrom(target.x, target.z, hx, hz), haze);
    fog.near = haze.near;
    fog.far = haze.far;
  }
  const near = THREE.MathUtils.clamp(distance * 0.012, 0.05, 4);
  const far = farPlane(distance);
  if (Math.abs(camera.near - near) > near * 0.1 || Math.abs(camera.far - far) > far * 0.1) {
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
  }
}
