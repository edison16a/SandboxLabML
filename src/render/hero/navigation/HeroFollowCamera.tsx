'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { FOLLOW } from '@/render/navigation/camera/shots';
import { useNavScene } from '@/render/navigation/frame/sceneContext';
import { applyLensShift, type PaneView } from '../stage/paneView';
import { followDistance, HeroFollow } from './heroFollow';

/** The far clip plane, m: past the edge of the backdrop city from any hero shot. */
const FAR = 900;

/**
 * Puts the follow shot on the camera every frame (see HeroFollow), with
 * the lens shifted so the runner sits in the middle of the part of the
 * pane the page text leaves free. The scene's sun keeps its shadow box on
 * whatever the default controls aim at, so the camera hands it its aim
 * through a stand in for those controls. The runner's see through
 * silhouette draws on a layer of its own, so the camera sees every layer.
 */
export function HeroFollowCamera({ pane }: { pane: PaneView }) {
  const { frame } = useNavScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const set = useThree((s) => s.set);
  const shot = useMemo(() => new HeroFollow(), []);
  const aim = useMemo(() => Object.assign(new THREE.EventDispatcher(), { target: new THREE.Vector3() }), []);

  useEffect(() => {
    camera.layers.enableAll();
    set({ controls: aim });
    return () => set({ controls: null });
  }, [camera, set, aim]);

  useFrame((_, rawDt) => {
    const course = frame.course;
    if (!course || frame.leader < 0) return;
    const distance = followDistance(pane, camera.fov);
    const p = frame.leaderPose;
    shot.update(p.x, p.z, course.halfLength, course.halfWidth, frame.epoch, distance, Math.min(rawDt, 0.5));
    camera.position.set(shot.pos.x, shot.pos.y, shot.pos.z);
    aim.target.set(shot.aim.x.value, FOLLOW.height, shot.aim.z.value);
    camera.lookAt(aim.target);
    const near = THREE.MathUtils.clamp(distance * 0.012, 0.05, 4);
    if (Math.abs(camera.near - near) > near * 0.1 || camera.far !== FAR) {
      camera.near = near;
      camera.far = FAR;
      camera.updateProjectionMatrix();
    }
    applyLensShift(camera, pane);
  });
  return null;
}
