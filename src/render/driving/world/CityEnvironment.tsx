'use client';

import * as THREE from 'three';
import { Environment, Lightformer } from '@react-three/drei';
import { Rng } from '@/engine/core/rng';
import { useDisposable } from '@/render/shared/useDisposable';
import { TIERS, type DrivingTier } from '../quality';
import { SUN_DIR } from './atmosphere';
import { SkyDome } from './sky/SkyDome';
import { SunLight } from './SunLight';

/**
 * A ring of dark towers and the grey street under the environment map's
 * horizon. Car paint and glass mirror the world round them; in a city that
 * is a broken skyline against a bright sky, the hard edge that makes a
 * body look glossy.
 */
function ReflectedCity() {
  const built = useDisposable(() => {
    const rng = new Rng(77);
    const boxes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 + rng.range(-0.03, 0.03);
      const r = rng.range(120, 220);
      const h = rng.range(18, 90);
      const w = rng.range(22, 44);
      boxes.push(new THREE.BoxGeometry(w, h, w).translate(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r).toNonIndexed());
    }
    const pos: number[] = [];
    for (const b of boxes) {
      pos.push(...(b.attributes.position.array as Float32Array));
      b.dispose();
    }
    const city = new THREE.BufferGeometry();
    city.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const cityMat = new THREE.MeshBasicMaterial({ color: '#8d8a84', fog: false });
    const ground = new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2).translate(0, -1.5, 0);
    const groundMat = new THREE.MeshBasicMaterial({ color: '#77716a', fog: false });
    return { city, cityMat, ground, groundMat, dispose: () => [city, cityMat, ground, groundMat].forEach((d) => d.dispose()) };
  }, []);
  return (
    <>
      <mesh geometry={built.ground} material={built.groundMat} />
      <mesh geometry={built.city} material={built.cityMat} />
    </>
  );
}

/** Soft bright panels only the reflections see: the sun's glow and long strips of sky light along the streets. */
function Highlights() {
  const p = SUN_DIR.clone().multiplyScalar(60);
  return (
    <>
      <Lightformer form="rect" intensity={2} color="#ffe6c8" position={[p.x, p.y, p.z]} scale={[22, 12, 1]} />
      <Lightformer form="rect" intensity={1.1} position={[0, 26, -70]} scale={[150, 3, 1]} />
      <Lightformer form="rect" intensity={1.1} position={[0, 26, 70]} rotation-y={Math.PI} scale={[150, 3, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[-70, 30, 0]} rotation-y={Math.PI / 2} scale={[150, 2, 1]} />
    </>
  );
}

/**
 * Sky, image based light and the sun. The environment map is rendered once
 * from the sky and a ring of towers, so paint and glass reflect a city with
 * no HDR download, and every lit surface takes its ambient light from it.
 */
export function CityEnvironment({ tier, focus, box }: { tier: DrivingTier; focus: React.RefObject<THREE.Vector3>; box?: React.RefObject<THREE.Vector3> }) {
  const look = TIERS[tier];
  return (
    <>
      <SkyDome octaves={look.skyOctaves} />
      <Environment resolution={look.envResolution} frames={1} environmentIntensity={0.6}>
        <SkyDome octaves={look.skyOctaves} follow={false} radius={900} />
        <ReflectedCity />
        {tier !== 'low' && <Highlights />}
      </Environment>
      <SunLight tier={tier} focus={focus} box={box} />
    </>
  );
}
