'use client';

import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Rng } from '@/engine/core/rng';
import type { Track } from '@/engine/racing/track/types';
import { useDisposable } from '@/render/shared/useDisposable';

interface Tree {
  x: number;
  z: number;
  scale: number;
  hue: number;
}

/**
 * Seeded trees around the circuit. Purely cosmetic: they are placed at least
 * 14 m from the road so they never sit inside the run-off, and the same track
 * always gets the same forest.
 */
function placeTrees(track: Track, count: number): Tree[] {
  const rng = new Rng(Number.parseInt(track.hash, 16) || 1);
  const { minX, minY, maxX, maxY } = track.bounds;
  const pad = 140;
  const trees: Tree[] = [];
  const clearance = (track.halfWidth + 14) ** 2;
  for (let attempt = 0; attempt < count * 6 && trees.length < count; attempt++) {
    const x = rng.range(minX - pad, maxX + pad);
    const y = rng.range(minY - pad, maxY + pad);
    let near = false;
    for (let i = 0; i < track.count; i += 3) {
      if ((track.cx[i] - x) ** 2 + (track.cy[i] - y) ** 2 < clearance) {
        near = true;
        break;
      }
    }
    if (!near) trees.push({ x, z: -y, scale: rng.range(0.75, 1.5), hue: rng.next() });
  }
  return trees;
}

export function Scenery({ track, count = 320 }: { track: Track; count?: number }) {
  const trees = useMemo(() => placeTrees(track, count), [track, count]);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const trunkGeo = useDisposable(() => new THREE.CylinderGeometry(0.22, 0.3, 2.4, 6).translate(0, 1.2, 0), []);
  const crownGeo = useDisposable(() => {
    const g = new THREE.ConeGeometry(1.9, 5.2, 7);
    g.translate(0, 4.6, 0);
    return g;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    trees.forEach((t, i) => {
      m.makeScale(t.scale, t.scale * (0.85 + t.hue * 0.4), t.scale);
      m.setPosition(t.x, 0, t.z);
      trunks.current?.setMatrixAt(i, m);
      crowns.current?.setMatrixAt(i, m);
      c.setHSL(0.27 + t.hue * 0.08, 0.42, 0.22 + t.hue * 0.1);
      crowns.current?.setColorAt(i, c);
    });
    for (const mesh of [trunks.current, crowns.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [trees]);

  return (
    <group>
      <instancedMesh key={`t${trees.length}`} ref={trunks} args={[trunkGeo, undefined, trees.length]} castShadow>
        <meshStandardMaterial color="#5b4331" roughness={0.9} />
      </instancedMesh>
      <instancedMesh key={`c${trees.length}`} ref={crowns} args={[crownGeo, undefined, trees.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
    </group>
  );
}
