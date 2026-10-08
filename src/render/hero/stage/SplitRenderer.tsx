'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { createPaneFade } from './paneFade';
import { applyLensShift, type PaneView } from './paneView';

/** How a scene's renderer is set up: the two scenes were tuned under different tone curves and exposures. */
export interface Tone {
  mapping: THREE.ToneMapping;
  exposure: number;
}

/** One scene of the stage and everything needed to draw it into its pane. */
export interface StageView {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pane: PaneView;
  tone: Tone;
  /** True once the scene has compiled and can draw without stalling the page. Nothing draws before. */
  warm: boolean;
  /** How far the scene has faded in over the poster, 0 to 1. */
  shown: number;
}

/** Seconds a pane takes to fade in over the poster once its scene is warm. */
const FADE_S = 1.2;

/**
 * Draws both hero scenes into one canvas, each in its own pane. The
 * renderer is shared, so before each pane it gets that scene's tone
 * curve, its exposure and a fresh shadow pass, then draws with the
 * viewport and scissor set to the pane. A pane whose scene is not warm
 * yet stays transparent and shows the poster under the canvas.
 * Priority 1 takes rendering over from three fiber.
 */
export function SplitRenderer({ views }: { views: readonly StageView[] }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const fade = useMemo(() => createPaneFade(), []);
  useEffect(() => () => fade.dispose(), [fade]);

  useFrame((_, rawDt) => {
    // Real time, not capped like the scenes' steps, so a slow machine still fades in over FADE_S.
    const dt = Math.min(rawDt, 0.5);
    gl.setScissorTest(false);
    // A scene's background leaves its color as the clear color, so the canvas is set back to transparent first.
    gl.setClearColor(0x000000, 0);
    gl.clear();
    for (const v of views) {
      if (!v.warm) continue;
      v.shown = Math.min(1, v.shown + dt / FADE_S);
      const r = v.pane.rect;
      const y = size.height - r.y - r.h;
      gl.setViewport(r.x, y, r.w, r.h);
      gl.setScissor(r.x, y, r.w, r.h);
      gl.setScissorTest(true);
      applyLensShift(v.camera, v.pane);
      gl.toneMapping = v.tone.mapping;
      gl.toneMappingExposure = v.tone.exposure;
      gl.shadowMap.needsUpdate = true;
      gl.render(v.scene, v.camera);
      if (v.shown < 1) {
        fade.keep.value = v.shown * v.shown * (3 - 2 * v.shown);
        const autoClear = gl.autoClear;
        gl.autoClear = false;
        gl.render(fade.scene, fade.camera);
        gl.autoClear = autoClear;
      }
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
  }, 1);
  return null;
}

/** A fresh view for one scene, with a camera of its own. */
export function createStageView(fov: number, near: number, far: number, tone: Tone, pane: PaneView): StageView {
  return { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(fov, 1, near, far), pane, tone, warm: false, shown: 0 };
}
