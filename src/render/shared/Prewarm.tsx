'use client';

import * as THREE from 'three';
import { useFrame, useStore } from '@react-three/fiber';
import { useEffect, useState } from 'react';

/** Time between logic steps of a held canvas while it warms up, ms. */
const STEP_MS = 100;
/** Steps after the scene has its data, so React can mount what the first frames bring in (players, boxes). */
const SETTLE_STEPS = 3;

/** Takes the frame over with a callback that draws nothing, so R3F renders nothing while the scene warms up. */
function HoldDrawing() {
  useFrame(() => {}, 1);
  return null;
}

/** Sends every texture the scene's materials use to the GPU now, rather than on the first frame that draws them. */
function uploadTextures(gl: THREE.WebGLRenderer, scene: THREE.Object3D): void {
  const seen = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const material = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      for (const v of Object.values(m)) {
        if (v instanceof THREE.Texture && !seen.has(v)) {
          seen.add(v);
          gl.initTexture(v);
        }
      }
    }
  });
}

interface Props {
  /** True once the scene has the data its first frame needs. */
  isReady: () => boolean;
  /** Step the scene's logic by hand: the canvas is held and runs no loop of its own. */
  stepping: boolean;
  /** Called once the scene can draw without stalling the page. */
  onWarm: () => void;
}

/**
 * Gets a scene ready to show without freezing whatever else is on screen.
 * Compiling shaders and uploading textures on a first frame can block the
 * page for a noticeable moment, so until then nothing is drawn: the
 * scene's logic steps (by hand while the canvas is held) until its data
 * is in and React has mounted it, then every shader compiles in the
 * background through KHR_parallel_shader_compile and every texture goes up.
 */
export function Prewarm({ isReady, stepping, onWarm }: Props) {
  const store = useStore();
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    if (warm) return;
    let gone = false;
    let settled = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const step = () => {
      if (gone) return;
      const s = store.getState();
      if (stepping) s.advance(s.clock.elapsedTime + STEP_MS / 1000, true);
      if (isReady()) settled++;
      if (settled < SETTLE_STEPS) {
        timer = setTimeout(step, STEP_MS);
        return;
      }
      // Without parallel compiling (Safari, software renderers) nothing can be polled, so the programs are only sent off.
      // Most drivers still finish them well before the scene first draws.
      const parallel = s.gl.extensions.has('KHR_parallel_shader_compile');
      const compiled = parallel ? s.gl.compileAsync(s.scene, s.camera) : Promise.resolve(s.gl.compile(s.scene, s.camera));
      void compiled.then(() => {
        if (gone) return;
        uploadTextures(s.gl, s.scene);
        setWarm(true);
        onWarm();
      });
    };
    timer = setTimeout(step, 0);
    return () => {
      gone = true;
      if (timer) clearTimeout(timer);
    };
  }, [store, isReady, stepping, onWarm, warm]);

  return warm ? null : <HoldDrawing />;
}
