'use client';

import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Track } from '@/engine/racing/track/types';
import { RUNOFF } from '@/engine/racing/car/runtime';
import { asphaltRoughness, asphaltTexture, checkerTexture, gravelTexture } from '@/render/shared/textures';
import { useDisposable } from '@/render/shared/useDisposable';
import { barrierPoses, centerDashGeometry, kerbGeometry, ribbon, startPose } from './trackGeometry';

/** The road, its markings, kerbs, run-off, barriers and the start gantry. */
export function TrackMesh({ track }: { track: Track }) {
  const hw = track.halfWidth;
  const road = useDisposable(() => ribbon(track, -hw, hw, 0.012, 8), [track]);
  const runoffL = useDisposable(() => ribbon(track, hw, hw + RUNOFF + 0.8, 0.006, 6), [track]);
  const runoffR = useDisposable(() => ribbon(track, -hw - RUNOFF - 0.8, -hw, 0.006, 6), [track]);
  const lineL = useDisposable(() => ribbon(track, hw - 0.42, hw - 0.18, 0.02), [track]);
  const lineR = useDisposable(() => ribbon(track, -hw + 0.18, -hw + 0.42, 0.02), [track]);
  const dashes = useDisposable(() => centerDashGeometry(track), [track]);
  const kerbs = useDisposable(() => kerbGeometry(track), [track]);

  const textures = useMemo(() => {
    const map = asphaltTexture();
    map.repeat.set(1.5, 1);
    const rough = asphaltRoughness();
    const gravel = gravelTexture();
    gravel.repeat.set(1, 1);
    return { map, rough, gravel, checker: checkerTexture(10) };
  }, []);

  return (
    <group>
      <mesh geometry={road} receiveShadow>
        <meshStandardMaterial map={textures.map} roughnessMap={textures.rough} roughness={0.92} metalness={0} color="#9aa0a8" />
      </mesh>
      <mesh geometry={runoffL} receiveShadow>
        <meshStandardMaterial map={textures.gravel} roughness={1} color="#d8cdb6" />
      </mesh>
      <mesh geometry={runoffR} receiveShadow>
        <meshStandardMaterial map={textures.gravel} roughness={1} color="#d8cdb6" />
      </mesh>
      <mesh geometry={lineL} receiveShadow>
        <meshStandardMaterial color="#f2f2f0" roughness={0.6} />
      </mesh>
      <mesh geometry={lineR} receiveShadow>
        <meshStandardMaterial color="#f2f2f0" roughness={0.6} />
      </mesh>
      <mesh geometry={dashes} receiveShadow>
        <meshStandardMaterial color="#e9e6dc" roughness={0.6} />
      </mesh>
      {kerbs && (
        <mesh geometry={kerbs} receiveShadow castShadow>
          <meshStandardMaterial vertexColors roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Barriers track={track} />
      <StartGantry track={track} checker={textures.checker} />
    </group>
  );
}

const barrierColors = { concrete: new THREE.Color('#c9ccd1'), red: new THREE.Color('#c8262b'), white: new THREE.Color('#f1f1f1') };

/** Concrete blocks along both sides, painted red and white near corners. */
function Barriers({ track }: { track: Track }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const poses = useMemo(() => barrierPoses(track, track.halfWidth + RUNOFF + 1.2, 2.05), [track]);
  const geometry = useDisposable(() => new THREE.BoxGeometry(2, 0.85, 0.45), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    poses.forEach((p, i) => {
      q.setFromAxisAngle(up, p.yaw);
      m.compose(new THREE.Vector3(p.x, 0.42, p.z), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m);
      const curvy = Math.abs(p.curvature) > 1 / 50;
      mesh.setColorAt(i, curvy ? ((i >> 1) % 2 ? barrierColors.red : barrierColors.white) : barrierColors.concrete);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [poses]);
  return (
    <instancedMesh key={poses.length} ref={ref} args={[geometry, undefined, poses.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

/** Checkered line across the road plus a simple overhead gantry. */
function StartGantry({ track, checker }: { track: Track; checker: THREE.Texture }) {
  const p = startPose(track);
  const w = track.halfWidth * 2;
  // Square checks: the texture has 10 cells, so repeat it along the line's length.
  const map = useMemo(() => {
    const t = checker.clone();
    t.repeat.set(1, w / 1.6);
    t.needsUpdate = true;
    return t;
  }, [checker, w]);
  const span = w + RUNOFF * 2 + 3;
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
        <planeGeometry args={[1.6, w]} />
        <meshStandardMaterial map={map} roughness={0.7} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 3, (s * span) / 2]} castShadow>
          <boxGeometry args={[0.45, 6, 0.45]} />
          <meshStandardMaterial color="#2a2f38" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 6.1, 0]} castShadow>
        <boxGeometry args={[0.9, 0.9, span + 0.45]} />
        <meshStandardMaterial color="#1b1f27" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.46, 6.1, 0]}>
        <boxGeometry args={[0.02, 0.32, span - 2]} />
        <meshStandardMaterial color="#4c9aff" emissive="#4c9aff" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
    </group>
  );
}
