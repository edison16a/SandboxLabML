'use client';

import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';

/** Box centers stay this far inside the room, m, so a dragged plank never pokes through a wall. */
const MARGIN = DEFAULT_HIDESEEK_PHYSICS.box.plank.length / 2 + 0.1;
const LIMIT = DEFAULT_HIDESEEK_PHYSICS.arena.size / 2 - MARGIN;
/** Moves are sent at most this often, ms: the match only runs at 30 Hz anyway. */
const SEND_EVERY = 33;

/** Read by the camera rig, which would otherwise switch the orbit controls back on mid drag. */
export const boxDrag = { active: false };

/**
 * Dragging a crate in the Sandbox. The pointer ray is intersected with a
 * horizontal plane at half box height, the hit is turned into the arena's
 * own coordinates and sent to the replay worker, which teleports the box.
 * The orbit camera is held still while a drag is on.
 */
export function useBoxDrag(origin: () => { x: number; z: number }, onMove: ((index: number, x: number, z: number) => void) | undefined) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const drag = useMemo(
    () => ({ index: -1, last: 0, raycaster: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), ndc: new THREE.Vector2(), hit: new THREE.Vector3(), cleanup: null as null | (() => void) }),
    [],
  );

  useEffect(() => () => drag.cleanup?.(), [drag]);

  return useCallback(
    (index: number, e: ThreeEvent<PointerEvent>) => {
      if (!onMove || e.button !== 0) return;
      e.stopPropagation();
      drag.index = index;
      boxDrag.active = true;
      // Stop the orbit right away; pointer moves can arrive before the camera rig's next frame.
      if (controls) controls.enabled = false;
      const el = gl.domElement;
      const move = (ev: PointerEvent) => {
        const now = performance.now();
        if (now - drag.last < SEND_EVERY) return;
        const rect = el.getBoundingClientRect();
        drag.ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
        drag.raycaster.setFromCamera(drag.ndc, camera);
        if (!drag.raycaster.ray.intersectPlane(drag.plane, drag.hit)) return;
        const o = origin();
        drag.last = now;
        onMove(drag.index, THREE.MathUtils.clamp(drag.hit.x - o.x, -LIMIT, LIMIT), THREE.MathUtils.clamp(drag.hit.z - o.z, -LIMIT, LIMIT));
      };
      const up = () => drag.cleanup?.();
      drag.cleanup = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        boxDrag.active = false;
        drag.index = -1;
        drag.cleanup = null;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [camera, gl, controls, drag, onMove, origin],
  );
}
