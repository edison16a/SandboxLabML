'use client';

import * as THREE from 'three';
import { useDisposable } from '@/render/shared/useDisposable';
import { BODY, WHEEL_SPOTS } from './dimensions';

/** The patch's size on the ground, m: a little wider and longer than the body. */
const PATCH = { across: BODY.width + 0.55, along: BODY.length + 0.7 };

/**
 * How dark the patch is at (x, z) on the ground, 0 to 1: a tight dark
 * spot under each tire sets the car on the road. With `core`, a soft
 * patch under the floor's middle joins them, kept well inside the sills.
 */
function darkness(x: number, z: number, core: boolean): number {
  const d = Math.hypot(Math.max(0, Math.abs(z) - 0.42), Math.max(0, Math.abs(x) - 1.75)) / 0.4;
  let a = core ? 0.75 * soft(1 - d) : 0;
  for (const [wx, wz] of WHEEL_SPOTS) {
    const d = Math.hypot((x - wx) / 0.34, (z - wz) / 0.2);
    a = Math.max(a, soft(1 - d));
  }
  return a;
}

/** Smoothstep on 0..1, clamped. */
const soft = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * A soft dark patch on the ground under the car, the ambient darkening
 * under the tires that makes a car sit on the road instead of hovering
 * over it. Where the sun casts shadows, the ambient occlusion pass
 * already darkens the floor under the body, and a core on top of it
 * would turn the gap under the sills into one black band; there only the
 * tire spots are drawn. On Low nothing else grounds the car, so `core`
 * adds the floor patch, and the road still shows past it under the sills.
 */
export function ContactShadow({ core }: { core: boolean }) {
  const built = useDisposable(() => {
    const w = 64;
    const h = 128;
    const data = new Uint8Array(w * h * 4);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        // The plane is turned so texel columns run across the car toward -z and rows along it from the nose back.
        const z = (0.5 - (col + 0.5) / w) * PATCH.across;
        const x = (0.5 - (row + 0.5) / h) * PATCH.along;
        data[(row * w + col) * 4 + 3] = Math.round(darkness(x, z, core) * 255);
      }
    }
    const map = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    // Black texels with the falloff in alpha: the map darkens, its alpha decides how much.
    // The units term keeps it in front of the road even looking straight down, where the slope term is zero.
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    const geometry = new THREE.PlaneGeometry(PATCH.across, PATCH.along).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
    return { material, geometry, dispose: () => (map.dispose(), material.dispose(), geometry.dispose()) };
  }, [core]);
  // Just above the road paint, so it darkens markings too.
  return <mesh geometry={built.geometry} material={built.material} position={[0, 0.016, 0]} renderOrder={-1} />;
}
