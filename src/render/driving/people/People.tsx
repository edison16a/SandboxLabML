'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { isOnRoad } from '@/engine/driving/city/surface';
import { MAX_PEDS } from '@/engine/driving/world/state';
import { useDisposable } from '@/render/shared/useDisposable';
import { CURB_HEIGHT } from '../city/ground/slabs';
import { useDrivingScene } from '../frame/sceneContext';
import { TIERS } from '../quality';
import { LOOKS } from './looks';
import { personGeometry } from './personGeometry';
import { createPersonMaterial } from './personShader';

const Y = new THREE.Vector3(0, 1, 0);

/**
 * Everyone in the city, in one instanced draw call: the walk cycle runs
 * in the vertex shader from each person's phase, so they stride at their
 * own pace and stand when they wait. Clothes, skin, hair and height come
 * from each person's look code. Shadows animate with them.
 */
export function People() {
  const { frame, city, tier } = useDrivingScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const time = useMemo(() => ({ value: 0 }), []);
  const fine = TIERS[tier].fineCrowd;
  const built = useDisposable(() => {
    const geometry = personGeometry(fine);
    const attr = (size: number) => new THREE.InstancedBufferAttribute(new Float32Array(MAX_PEDS * size), size).setUsage(THREE.DynamicDrawUsage);
    const anim = attr(4);
    const skin = attr(3);
    const shirt = attr(3);
    const pants = attr(3);
    const hair = attr(3);
    geometry.setAttribute('aAnim', anim);
    geometry.setAttribute('aSkin', skin);
    geometry.setAttribute('aShirt', shirt);
    geometry.setAttribute('aPants', pants);
    geometry.setAttribute('aHair', hair);
    const { material, depth } = createPersonMaterial(time);
    return { geometry, anim, skin, shirt, pants, hair, material, depth, dispose: () => [geometry, material, depth].forEach((x) => x.dispose()) };
  }, [fine, time]);
  // The dress cache belongs to one set of buffers: a rebuilt mesh starts undressed.
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), looks: new Int16Array(MAX_PEDS).fill(-1), built }), [built]);

  useFrame((_, dt) => {
    const g = mesh.current;
    const world = frame.world;
    time.value += Math.min(dt, 0.1);
    if (!g || !world) return;
    g.customDepthMaterial = built.depth;
    let dressed = false;
    for (let i = 0; i < world.pedCount; i++) {
      const code = world.pedLook[i];
      const look = LOOKS[code];
      const h = isOnRoad(city, world.pedX[i], world.pedY[i]) ? 0 : CURB_HEIGHT;
      tmp.m.compose(tmp.p.set(world.pedX[i], h, -world.pedY[i]), tmp.q.setFromAxisAngle(Y, world.pedHeading[i]), tmp.s.set(look.scale, look.scale, look.scale));
      g.setMatrixAt(i, tmp.m);
      built.anim.setXYZW(i, world.pedPhase[i], world.pedState[i], 0, (code * 0.137) % 1);
      if (tmp.looks[i] !== code) {
        tmp.looks[i] = code;
        built.skin.setXYZ(i, look.skin.r, look.skin.g, look.skin.b);
        built.shirt.setXYZ(i, look.shirt.r, look.shirt.g, look.shirt.b);
        built.pants.setXYZ(i, look.pants.r, look.pants.g, look.pants.b);
        built.hair.setXYZ(i, look.hair.r, look.hair.g, look.hair.b);
        dressed = true;
      }
    }
    g.count = world.pedCount;
    g.instanceMatrix.needsUpdate = true;
    built.anim.needsUpdate = true;
    if (dressed) built.skin.needsUpdate = built.shirt.needsUpdate = built.pants.needsUpdate = built.hair.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[built.geometry, built.material, MAX_PEDS]} castShadow={tier !== 'low'} receiveShadow frustumCulled={false} />;
}
