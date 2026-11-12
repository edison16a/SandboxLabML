import * as THREE from 'three';

/** Key light direction: high and from the front left, so walls and crates throw readable shadows. */
export const KEY = new THREE.Vector3(-0.55, 1, 0.42).normalize();

/**
 * The shadow camera's own axes. It looks along -KEY with +y up, so three
 * builds its right axis as up x KEY and its up axis as KEY x right: the
 * axes of the shadow map itself.
 */
export const LIGHT_RIGHT = new THREE.Vector3(0, 1, 0).cross(KEY).normalize();
export const LIGHT_UP = KEY.clone().cross(LIGHT_RIGHT);

/**
 * Where to aim the sun for a view centered on (x, 0, z), written into
 * `out`: the point moved to whole texels of the shadow map along its right
 * and up axes, its depth along KEY kept. The map then only ever slides by
 * whole texels as the view glides, so shadow edges stay still. Snapping in
 * world x and z would not do: the light is diagonal, so a world step of a
 * texel moves the map by a fraction of one.
 */
export function snapShadowTarget(x: number, z: number, texel: number, out: THREE.Vector3): THREE.Vector3 {
  const u = Math.round((x * LIGHT_RIGHT.x + z * LIGHT_RIGHT.z) / texel) * texel;
  const v = Math.round((x * LIGHT_UP.x + z * LIGHT_UP.z) / texel) * texel;
  const w = x * KEY.x + z * KEY.z;
  return out.set(LIGHT_RIGHT.x * u + LIGHT_UP.x * v + KEY.x * w, LIGHT_RIGHT.y * u + LIGHT_UP.y * v + KEY.y * w, LIGHT_RIGHT.z * u + LIGHT_UP.z * v + KEY.z * w);
}
