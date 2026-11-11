'use client';

import * as THREE from 'three';
import { useDisposable } from '@/render/shared/useDisposable';
import { BODY } from './dimensions';

/**
 * A soft dark patch on the ground under the car. The sun's shadow falls off
 * to one side; this is the ambient darkening right under the floor and the
 * tires that makes a car sit on the road instead of hovering over it.
 */
export function ContactShadow() {
  const built = useDisposable(() => {
    const w = 64;
    const h = 128;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Distance outside a rounded rectangle, faded over the outer part of the patch.
        const u = Math.abs((x + 0.5) / w - 0.5) * 2;
        const v = Math.abs((y + 0.5) / h - 0.5) * 2;
        const d = Math.hypot(Math.max(0, u - 0.55), Math.max(0, v - 0.72)) / 0.42;
        const a = Math.max(0, 1 - d);
        data[(y * w + x) * 4 + 3] = Math.round(a * a * (3 - 2 * a) * 255);
      }
    }
    const map = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    // Black texels with the falloff in alpha: the map darkens, its alpha decides how much.
    // The units term keeps it in front of the road even looking straight down, where the slope term is zero.
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    const geometry = new THREE.PlaneGeometry(BODY.width + 0.55, BODY.length + 0.7).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
    return { material, geometry, dispose: () => (map.dispose(), material.dispose(), geometry.dispose()) };
  }, []);
  // Just above the road paint, so it darkens markings too.
  return <mesh geometry={built.geometry} material={built.material} position={[0, 0.016, 0]} renderOrder={-1} />;
}
