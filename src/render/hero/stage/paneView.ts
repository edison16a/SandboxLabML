import type * as THREE from 'three';
import type { Pane } from './splitLayout';

/** What a scene's camera knows of its pane. The page hands a new one to the scene on every resize, and the camera reads it each frame. */
export type PaneView = Pane;

/**
 * Projects the camera onto the pane. The lens is shifted so the point the
 * camera looks straight at lands on the pane's focus instead of the middle
 * of its shot: a shifted lens keeps verticals upright and the perspective
 * of a camera aimed at its subject, which a camera turned to put the
 * subject off center would not. The canvas then shows only the view part
 * of the shot, so a window that crops the poster frame crops the scene
 * the same way. The aspect is the whole shot's, so pixels stay square.
 */
export function applyLensShift(camera: THREE.PerspectiveCamera, view: PaneView): void {
  const { w, h } = view.shot;
  const v = view.view;
  camera.aspect = w / h;
  camera.setViewOffset(w, h, (0.5 - view.focusX) * w + v.x, (0.5 - view.focusY) * h + v.y, v.w, v.h);
}
