import type * as THREE from 'three';
import type { Pane, Rect } from './splitLayout';

/**
 * What a scene's camera knows of its pane, kept in one object that the
 * stage updates in place whenever the hero resizes. Cameras read it every
 * frame, so a resize reframes them without a React render.
 */
export interface PaneView {
  /** The pane in CSS px, from the top left of the hero. */
  rect: Rect;
  focusX: number;
  focusY: number;
  zoneW: number;
  zoneH: number;
}

export function createPaneView(): PaneView {
  return { rect: { x: 0, y: 0, w: 1, h: 1 }, focusX: 0.5, focusY: 0.5, zoneW: 1, zoneH: 1 };
}

/** Copies a freshly computed pane into the view the cameras hold. */
export function setPaneView(view: PaneView, pane: Pane): void {
  Object.assign(view.rect, pane.rect);
  view.focusX = pane.focusX;
  view.focusY = pane.focusY;
  view.zoneW = pane.zoneW;
  view.zoneH = pane.zoneH;
}

/**
 * Shifts the lens so that the point the camera looks straight at lands on
 * the pane's focus instead of its middle. A shifted lens keeps verticals
 * upright and the perspective of a camera aimed at its subject, which a
 * camera turned to put the subject off center would not.
 */
export function applyLensShift(camera: THREE.PerspectiveCamera, view: PaneView): void {
  const { w, h } = view.rect;
  camera.setViewOffset(w, h, (0.5 - view.focusX) * w, (0.5 - view.focusY) * h, w, h);
}
