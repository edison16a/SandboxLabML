'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { TIERS, type DrivingTier } from '../quality';
import { ATMOSPHERE, SUN_DIR } from './atmosphere';

interface Props {
  tier: DrivingTier;
  /** World point the shadow box follows (the camera target). */
  focus: React.RefObject<THREE.Vector3>;
  /** Written every frame with the shadow box's center, so scenery can tell which items may cast into it. */
  box?: React.RefObject<THREE.Vector3>;
}

/**
 * The shadow camera's own right and up axes. It looks down SUN_DIR with
 * world up, exactly as three's lookAt builds it, so snapping a point's
 * coordinates on these axes to whole texels lines it up with the shadow
 * map's grid. Snapping world x and z instead still slides the grid by part
 * of a texel, because the grid is turned against the world.
 */
const RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize();
const UP = new THREE.Vector3().crossVectors(SUN_DIR, RIGHT);

/**
 * The sun and the sky's fill light. The sun casts the only real shadows,
 * from a box that follows the action; the hemisphere adds blue from above
 * and warm bounce from the dry ground below, the way open country lights
 * a car's flanks.
 */
export function SunLight({ tier, focus, box }: Props) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => ({ center: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const look = TIERS[tier];
  const size = look.shadowBox;
  const map = look.shadowMap;
  // One texel of the shadow map in world meters: the box snaps to it so shadows never crawl as the camera moves.
  const texel = (size * 2) / map;

  useFrame(({ camera }) => {
    const l = light.current;
    const f = focus.current;
    if (!l || !f) return;
    // Center the box a little ahead of the target, where the camera is looking, so more of what is on screen gets shadows.
    camera.getWorldDirection(tmp.look).setY(0);
    if (tmp.look.lengthSq() > 1e-6) tmp.look.normalize();
    const c = tmp.center.copy(f).addScaledVector(tmp.look, size * 0.4).setY(0);
    // Snap on the shadow camera's own axes, keeping the distance along the sun as it is.
    const a = Math.round(c.dot(RIGHT) / texel) * texel;
    const b = Math.round(c.dot(UP) / texel) * texel;
    const d = c.dot(SUN_DIR);
    c.copy(RIGHT).multiplyScalar(a).addScaledVector(UP, b).addScaledVector(SUN_DIR, d);
    target.position.copy(c);
    box?.current?.copy(c);
    l.position.copy(c).addScaledVector(SUN_DIR, 220);
    target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={['#d3dceb', '#9a8670', 0.75]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={4.3}
        color={ATMOSPHERE.sun}
        castShadow={look.shadows}
        shadow-mapSize={[map, map]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.05}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-near={20}
        shadow-camera-far={520}
      />
    </>
  );
}
