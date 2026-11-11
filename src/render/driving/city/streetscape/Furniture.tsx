'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { broadleafGeometry } from '../../flora/broadleafGeometry';
import { createFoliageMaterial } from '../../flora/foliageMaterial';
import { ATLAS_TILE, foliageAtlas, releaseFoliageAtlas } from '../../flora/textures/foliageAtlas';
import { detailTier, type DrivingTier } from '../../quality';
import { withHaze } from '../../world/atmosphere';
import { CURB_HEIGHT } from '../ground/slabs';
import { benchGeometry, binGeometry, lampGlassGeometry, lampPostGeometry, planterGeometry } from './furnitureGeometry';
import { Instances } from './Instances';
import type { Spot, Streetscape } from './layout';

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const s = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** Matrices for spots on the sidewalk, each turned to its heading, optionally scaled and turned a little at random. */
function matrices(spots: Spot[], scale: (sp: Spot) => number = () => 1, spin = 0): THREE.Matrix4[] {
  return spots.map((sp) => {
    const k = scale(sp);
    return m.compose(p.set(sp.x, CURB_HEIGHT, -sp.y), q.setFromAxisAngle(Y, sp.heading + spin * (sp.seed - 0.5) * Math.PI * 2), s.set(k, k, k)).clone();
  });
}

/** Street trees: two crown shapes, each one instanced draw call, swaying in the wind and casting dappled shade. */
function Trees({ spots, tier }: { spots: Spot[]; tier: DrivingTier }) {
  const meshes = useRef<Array<THREE.InstancedMesh | null>>([]);
  const groups = useMemo(() => [spots.filter((t) => t.seed < 0.5), spots.filter((t) => t.seed >= 0.5)], [spots]);
  const built = useDisposable(() => {
    const atlas = foliageAtlas(ATLAS_TILE[detailTier(tier)]);
    const foliage = createFoliageMaterial(atlas, 7, 0.12);
    const geos = [broadleafGeometry(0), broadleafGeometry(1)];
    return { foliage, geos, dispose: () => (geos.forEach((g) => g.dispose()), foliage.material.dispose(), foliage.depth.dispose(), releaseFoliageAtlas()) };
  }, [tier]);
  useLayoutEffect(() => {
    const tint = new THREE.Color();
    groups.forEach((list, v) => {
      const mesh = meshes.current[v];
      if (!mesh) return;
      matrices(list, (t) => 0.6 + t.seed * 0.2, 1).forEach((mat, i) => {
        mesh.setMatrixAt(i, mat);
        mesh.setColorAt(i, tint.setRGB(0.88 + ((i * 37) % 13) / 60, 0.95 + ((i * 17) % 7) / 70, 0.85));
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.customDepthMaterial = built.foliage.depth;
    });
  }, [groups, built]);
  useFrame((_, dt) => void (built.foliage.time.value += Math.min(dt, 0.1)));
  return (
    <>
      {groups.map((list, v) => (
        <instancedMesh key={v} ref={(el) => void (meshes.current[v] = el)} args={[built.geos[v], built.foliage.material, Math.max(1, list.length)]} castShadow={tier !== 'low'} receiveShadow frustumCulled={false} />
      ))}
    </>
  );
}

/**
 * Lamps, trees in planters, benches and bins along every sidewalk. All
 * static, a draw call per kind of thing.
 */
export function Furniture({ street, tier }: { street: Streetscape; tier: DrivingTier }) {
  const built = useDisposable(() => {
    const parts = { post: lampPostGeometry(), glass: lampGlassGeometry(), planter: planterGeometry(), bench: benchGeometry(), bin: binGeometry() };
    const mat = withHaze(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.35 }));
    const glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.5, 0.42), toneMapped: false });
    return { ...parts, mat, glassMat, dispose: () => [...Object.values(parts), mat, glassMat].forEach((x) => x.dispose()) };
  }, []);
  const lamps = useMemo(() => matrices(street.lamps), [street]);
  const planters = useMemo(() => matrices(street.trees), [street]);
  const benches = useMemo(() => matrices(street.benches), [street]);
  const bins = useMemo(() => matrices(street.bins), [street]);
  const shadows = tier !== 'low';
  return (
    <group>
      <Instances geometry={built.post} material={built.mat} matrices={lamps} shadows={shadows} />
      <Instances geometry={built.glass} material={built.glassMat} matrices={lamps} />
      <Instances geometry={built.planter} material={built.mat} matrices={planters} />
      <Instances geometry={built.bench} material={built.mat} matrices={benches} shadows={shadows} />
      <Instances geometry={built.bin} material={built.mat} matrices={bins} shadows={shadows} />
      <group position-y={0.42}>
        <Trees spots={street.trees} tier={tier} />
      </group>
    </group>
  );
}
