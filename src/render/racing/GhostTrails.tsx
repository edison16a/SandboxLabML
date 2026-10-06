'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { ghostColor } from './palette';
import { useRacingScene } from './sceneContext';

const MAX_GHOSTS = 64;
/** Two seconds of history at 30 snapshots per second. */
const HISTORY = 60;
const STRIDE = RACING_SNAPSHOT.stride;

/**
 * Fading trails behind each ghost, all in one LineSegments buffer. Each
 * ghost keeps a ring of its last 60 positions; alpha falls off with age.
 */
export function GhostTrails() {
  const { ghosts } = useRacingScene();
  const built = useDisposable(() => {
    const segs = MAX_GHOSTS * (HISTORY - 1);
    const geometry = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(segs * 2 * 3), 3);
    const col = new THREE.BufferAttribute(new Float32Array(segs * 2 * 4), 4);
    pos.setUsage(THREE.DynamicDrawUsage);
    col.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', pos);
    geometry.setAttribute('color', col);
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    return { lines, pos, col, dispose: () => (geometry.dispose(), material.dispose()) };
  }, []);
  const ring = useMemo(() => ({ xs: new Float32Array(MAX_GHOSTS * HISTORY), zs: new Float32Array(MAX_GHOSTS * HISTORY), head: 0, filled: 0, tick: -1, epoch: -1, c: new THREE.Color() }), []);

  useFrame(() => {
    const { view, ghostTrails } = useRacingLab.getState();
    const visible = !!ghosts?.curr && view !== 'population' && ghostTrails;
    built.lines.visible = visible;
    if (!visible || !ghosts?.curr) return;
    if (ring.epoch !== ghosts.epoch) {
      ring.epoch = ghosts.epoch;
      ring.filled = 0;
      ring.head = 0;
      ring.tick = -1;
    }
    const n = Math.min(ghosts.count, MAX_GHOSTS);
    if (ghosts.curr.tick !== ring.tick) {
      ring.tick = ghosts.curr.tick;
      ring.head = (ring.head + 1) % HISTORY;
      ring.filled = Math.min(HISTORY, ring.filled + 1);
      const buf = ghosts.curr.buffer;
      for (let i = 0; i < n; i++) {
        ring.xs[i * HISTORY + ring.head] = buf[i * STRIDE];
        ring.zs[i * HISTORY + ring.head] = -buf[i * STRIDE + 1];
      }
    }
    let v = 0;
    const p = built.pos.array as Float32Array;
    const c = built.col.array as Float32Array;
    for (let i = 0; i < n; i++) {
      ghostColor(n > 1 ? i / (n - 1) : 1, ring.c);
      for (let k = 0; k < ring.filled - 1; k++) {
        const a = (ring.head - k + HISTORY) % HISTORY;
        const b = (a - 1 + HISTORY) % HISTORY;
        const alphaA = 0.55 * (1 - k / HISTORY);
        const alphaB = 0.55 * (1 - (k + 1) / HISTORY);
        p.set([ring.xs[i * HISTORY + a], 0.08, ring.zs[i * HISTORY + a], ring.xs[i * HISTORY + b], 0.08, ring.zs[i * HISTORY + b]], v * 3);
        c.set([ring.c.r, ring.c.g, ring.c.b, alphaA, ring.c.r, ring.c.g, ring.c.b, alphaB], v * 4);
        v += 2;
      }
    }
    built.lines.geometry.setDrawRange(0, v);
    built.pos.needsUpdate = true;
    built.col.needsUpdate = true;
  });

  return <primitive object={built.lines} />;
}
