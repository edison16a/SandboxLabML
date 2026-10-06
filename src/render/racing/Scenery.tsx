'use client';

import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Rng } from '@/engine/core/rng';
import type { Track } from '@/engine/racing/track/types';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useDisposable } from '@/render/shared/useDisposable';

interface Tree {
  x: number;
  z: number;
  scale: number;
  hue: number;
  yaw: number;
  /** About a third of the trees are round broadleaf ones; the rest are pines. */
  round: boolean;
}

/** A pine as three stacked cones, each a little narrower, so it reads as layered branches. */
function pineGeometry(): THREE.BufferGeometry {
  const tiers = [
    [2.1, 2.8, 3.1],
    [1.65, 2.5, 4.5],
    [1.15, 2.2, 5.8],
  ].map(([r, h, y]) => new THREE.ConeGeometry(r, h, 8).translate(0, y, 0).toNonIndexed());
  return mergeGeometries(tiers) as THREE.BufferGeometry;
}

/** A broadleaf crown: a low poly ball, a little taller than wide. */
function roundGeometry(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(2.1, 1).scale(1, 1.12, 1).translate(0, 4.3, 0);
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
    if (!near) trees.push({ x, z: -y, scale: rng.range(0.75, 1.5), hue: rng.next(), yaw: rng.range(0, Math.PI * 2), round: rng.next() < 0.32 });
  }
  return trees;
}

export function Scenery({ track, count = 320 }: { track: Track; count?: number }) {
  const trees = useMemo(() => placeTrees(track, count), [track, count]);
  const pines = useMemo(() => trees.filter((t) => !t.round), [trees]);
  const rounds = useMemo(() => trees.filter((t) => t.round), [trees]);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const pineCrowns = useRef<THREE.InstancedMesh>(null);
  const roundCrowns = useRef<THREE.InstancedMesh>(null);
  const geo = useDisposable(() => {
    const g = { trunk: new THREE.CylinderGeometry(0.2, 0.3, 2.6, 6).translate(0, 1.3, 0), pine: pineGeometry(), round: roundGeometry() };
    return { ...g, dispose: () => Object.values(g).forEach((x) => x.dispose()) };
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    const place = (t: Tree) => m.compose(new THREE.Vector3(t.x, 0, t.z), q.setFromAxisAngle(up, t.yaw), new THREE.Vector3(t.scale, t.scale * (0.85 + t.hue * 0.4), t.scale));
    trees.forEach((t, i) => trunks.current?.setMatrixAt(i, place(t)));
    pines.forEach((t, i) => {
      pineCrowns.current?.setMatrixAt(i, place(t));
      pineCrowns.current?.setColorAt(i, c.setHSL(0.3 + t.hue * 0.06, 0.38, 0.17 + t.hue * 0.08));
    });
    rounds.forEach((t, i) => {
      roundCrowns.current?.setMatrixAt(i, place(t));
      roundCrowns.current?.setColorAt(i, c.setHSL(0.24 + t.hue * 0.06, 0.46, 0.16 + t.hue * 0.08));
    });
    for (const mesh of [trunks.current, pineCrowns.current, roundCrowns.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [trees, pines, rounds]);

  return (
    <group>
      <instancedMesh key={`t${trees.length}`} ref={trunks} args={[geo.trunk, undefined, trees.length]} castShadow>
        <meshStandardMaterial color="#5b4331" roughness={0.9} />
      </instancedMesh>
      <instancedMesh key={`p${pines.length}`} ref={pineCrowns} args={[geo.pine, undefined, pines.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh key={`r${rounds.length}`} ref={roundCrowns} args={[geo.round, undefined, rounds.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.8} flatShading />
      </instancedMesh>
    </group>
  );
}
