'use client';

import * as THREE from 'three';
import { useDisposable } from '@/render/shared/useDisposable';
import { withHaze } from '../world/atmosphere';
import { brandTexture } from './brandTexture';
import type { StadiumLayout } from './layout';
import { PIT_LANE as LANE, PIT_TOP, pitGlass, pitMullions, pitShell } from './pitGeometry';

/**
 * The pit building on the infield side of the main straight, facing the
 * grandstands: garages, a glass upper floor that mirrors the sky, the lab's
 * board on the canopy, and the pit lane in front of it.
 */
export function PitBuilding({ layout }: { layout: StadiumLayout }) {
  const pit = layout.pit;
  const side = -layout.side;
  const built = useDisposable(() => {
    if (!pit) return null;
    const geo = { shell: pitShell(pit.length, pit.depth), glass: pitGlass(pit.length), mullions: pitMullions(pit.length) };
    const board = brandTexture('light', 10);
    const mat = {
      shell: withHaze(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, envMapIntensity: 0.8 })),
      glass: withHaze(new THREE.MeshStandardMaterial({ color: '#16202c', metalness: 0.9, roughness: 0.06, envMapIntensity: 1.4 })),
      sign: withHaze(new THREE.MeshStandardMaterial({ map: board, roughness: 0.5 })),
      lane: withHaze(new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.92 })),
      line: withHaze(new THREE.MeshStandardMaterial({ color: '#e6e5df', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })),
    };
    const all = [...Object.values(geo), board, ...Object.values(mat)];
    return { geo, mat, dispose: () => all.forEach((x) => x.dispose()) };
  }, [pit]);
  if (!pit || !built) return null;
  const { geo, mat } = built;
  const sign = Math.min(20, pit.length * 0.45);
  const lane = (pit.laneHalf ?? pit.length / 2) * 2;
  return (
    <group position={[layout.x, 0, layout.z]} rotation={[0, layout.yaw, 0]}>
      {/* Turned half round on the far side, so the building's own -z faces the road. */}
      <group position={[pit.along, 0, side * pit.offset]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
        <mesh geometry={geo.shell} material={mat.shell} castShadow receiveShadow />
        <mesh geometry={geo.glass} material={mat.glass} />
        <mesh geometry={geo.mullions} material={mat.shell} />
        {/* The board stands on the roof's front edge. */}
        <mesh position={[0, PIT_TOP + 0.45 + sign / 20, -3.9]} rotation={[0, Math.PI, 0]} material={mat.sign}>
          <planeGeometry args={[sign, sign / 10]} />
        </mesh>
        <mesh position={[0, 0.008, -LANE / 2]} rotation={[-Math.PI / 2, 0, 0]} material={mat.lane} receiveShadow>
          <planeGeometry args={[lane, LANE]} />
        </mesh>
        <mesh position={[0, 0.014, -LANE * 0.62]} rotation={[-Math.PI / 2, 0, 0]} material={mat.line}>
          <planeGeometry args={[lane, 0.18]} />
        </mesh>
      </group>
    </group>
  );
}
