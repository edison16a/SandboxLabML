'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, blendFloorPose } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { HS_TONE_MAPPING } from '../palette';
import { farPlane } from '../scene/haze';
import { PIP_AGENTS, pipRects } from './pipLayout';

const EYE = 1.32;
/**
 * The views render after every scene update (priority 0) and before the
 * main pass (1). Rendered earlier, they would show the agents and crates
 * where the last frame left them, and after a round reset the hider's
 * camera would look straight at its own body back at the old spot.
 */
const POV_PRIORITY = 0.5;

/**
 * First person views from both agents of the focused arena, shown picture
 * in picture. Each view renders into its own target, one view per frame in
 * turn, so the extra cost is a single small scene pass. The grid lives on
 * layer 1 and these cameras only see layer 0, so they draw just the room.
 * The targets are then drawn as two quads after the main image.
 */
export function PovViews() {
  const { frame } = useHsScene();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const rects = pipRects(size.width, size.height);
  const w = Math.round(rects[0].width * dpr);
  const h = Math.round(rects[0].height * dpr);
  const built = useDisposable(() => {
    const targets = [0, 1].map(() => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 }));
    // Their far plane lies past the end of the haze, like the main camera's, so the ground fades out instead of stopping.
    const cameras = [0, 1].map(() => new THREE.PerspectiveCamera(80, w / h, 0.05, farPlane(0)));
    const overlay = new THREE.Scene();
    const ortho = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
    const plane = new THREE.PlaneGeometry(1, 1);
    const quads = targets.map((t) => {
      const q = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: t.texture, depthTest: false, depthWrite: false }));
      overlay.add(q);
      return q;
    });
    return {
      targets,
      cameras,
      overlay,
      ortho,
      quads,
      dispose: () => {
        targets.forEach((t) => t.dispose());
        quads.forEach((q) => (q.material as THREE.Material).dispose());
        plane.dispose();
      },
    };
  }, [w, h]);
  const state = useMemo(() => ({ turn: 0, o: { x: 0, z: 0 }, pose: { x: 0, z: 0, yaw: 0 } }), []);

  useFrame(() => {
    const curr = frame.curr;
    if (!curr || frame.focusSlot < 0) return;
    const k = state.turn++ % 2;
    const cam = built.cameras[k];
    arenaOrigin(frame.focusSlot, frame.lattice, state.o);
    blendFloorPose(frame.prev, curr, agentAt(frame.first + frame.focusSlot, PIP_AGENTS[k]), frame.alpha, state.pose);
    const fx = Math.cos(state.pose.yaw);
    const fz = -Math.sin(state.pose.yaw);
    cam.position.set(state.o.x + state.pose.x + fx * 0.45, EYE, state.o.z + state.pose.z + fz * 0.45);
    cam.lookAt(cam.position.x + fx * 5, 0.95, cam.position.z + fz * 5);
    gl.setRenderTarget(built.targets[k]);
    gl.clear();
    gl.render(scene, cam);
    gl.setRenderTarget(null);
  }, POV_PRIORITY);

  return <PipPresenter overlay={built.overlay} ortho={built.ortho} quads={built.quads} />;
}

/**
 * Draws the two views over the finished frame. It runs after everything
 * else (priority 2), so the main image, with or without post-processing,
 * is already on screen. The views are tone mapped here, since the main
 * pass may have left tone mapping to the effect composer.
 */
function PipPresenter({ overlay, ortho, quads }: { overlay: THREE.Scene; ortho: THREE.OrthographicCamera; quads: THREE.Mesh[] }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const { frame } = useHsScene();
  useFrame(() => {
    if (frame.focusSlot < 0) return;
    const rects = pipRects(size.width, size.height);
    ortho.left = 0;
    ortho.right = size.width;
    ortho.top = size.height;
    ortho.bottom = 0;
    ortho.updateProjectionMatrix();
    quads.forEach((q, k) => {
      const r = rects[k];
      q.position.set(r.left + r.width / 2, size.height - r.top - r.height / 2, 0);
      q.scale.set(r.width, r.height, 1);
    });
    const autoClear = gl.autoClear;
    const toneMapping = gl.toneMapping;
    gl.autoClear = false;
    gl.toneMapping = HS_TONE_MAPPING;
    gl.render(overlay, ortho);
    gl.autoClear = autoClear;
    gl.toneMapping = toneMapping;
  }, 2);
  return null;
}
