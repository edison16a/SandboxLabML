'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { characterKit } from '@/render/hideseek/characters/characterKit';
import { CharacterMaterials } from '@/render/hideseek/characters/characterMaterials';
import { CharacterMotion } from '@/render/hideseek/characters/motion/characterMotion';
import { createSkeleton } from '@/render/hideseek/characters/rig/bones';
import { CharacterPoser } from '@/render/hideseek/characters/rig/poser';
import { seekerRingMaterial } from '@/render/hideseek/characters/seekerRing';
import { createCharacterDrive, type CharacterDetail, type CharacterDrive } from '@/render/hideseek/characters/types';
import { XRAY_LAYER } from '@/render/hideseek/grid/scratch';
import { useDisposable } from '@/render/shared/useDisposable';
import { POSE_PRIORITY, useNavScene } from '../frame/sceneContext';
import { NAV_COLORS } from '../palette';
import { crushAlongForward } from './crushAxis';
import { createStopPose, type StopPose } from './stopPose';

/** The ring color, pushed past 1 so bloom catches it where it runs. */
const RING = new THREE.Color(NAV_COLORS.championRing).multiplyScalar(1.5);
const GREY = new THREE.Color(NAV_COLORS.dormant);
const FLASH = new THREE.Color(NAV_COLORS.senseSpikes);
const CRUSH_FLASH = new THREE.Color(NAV_COLORS.senseMover);

export interface NavCharacterProps {
  /** Fills in where it is and what it does, and how its run ended (`stop`). Return false to hide it. */
  read: (drive: CharacterDrive, stop: StopPose) => boolean | void;
  detail: CharacterDetail;
  shadows: boolean;
  /** A soft round shadow under it, for tiers without shadow maps. */
  blob: boolean;
}

/**
 * The champion: the full Hide and Seek character in the runner blue, with
 * the same rig and motion model (planted feet, IK knees and elbows, a
 * trunk that leans with its momentum, eyes on what matters), standing in a
 * soft ring. When its run ends it falls, squashes or hops exactly as the
 * crowd does (see stopPose). Behind a crate it still shows as a faint
 * silhouette.
 */
export function NavCharacter({ read, detail, shadows, blob }: NavCharacterProps) {
  const { frame } = useNavScene();
  const kit = characterKit(detail);
  const mats = useDisposable(() => new CharacterMaterials('hider', detail, kit.blobMap), [detail, kit]);
  const ringMat = useDisposable(() => seekerRingMaterial(RING), []);
  const rig = useDisposable(() => {
    const { root, bones, skeleton } = createSkeleton();
    const body = new THREE.SkinnedMesh(kit.body, mats.body);
    const face = new THREE.SkinnedMesh(kit.face, mats.face);
    const ghost = new THREE.SkinnedMesh(kit.body, mats.ghost);
    ghost.renderOrder = 3;
    face.renderOrder = 4;
    ghost.layers.set(XRAY_LAYER);
    ghost.raycast = () => {};
    for (const m of [body, face, ghost]) {
      m.bind(skeleton);
      // The bind pose has every part at the origin, so computed bounds would be wrong; it is always drawn.
      m.frustumCulled = false;
      m.receiveShadow = shadows;
    }
    body.castShadow = shadows;
    return { root, body, face, ghost, poser: new CharacterPoser(bones), dispose: () => skeleton.dispose() };
  }, [kit, mats, shadows]);
  const state = useMemo(() => ({ drive: createCharacterDrive(), stop: createStopPose(), motion: new CharacterMotion(7) }), []);
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const visible = read(state.drive, state.stop) !== false;
    g.visible = visible;
    if (!visible) return;
    const d = state.drive;
    const st = state.stop;
    d.airborne = st.airborne;
    // The body runs on simulation time: it stops with a paused run and hurries with a fast one.
    const pose = state.motion.update(d, dt, clock.elapsedTime, dt > 0 ? Math.min(8, frame.simDt / dt) : 0);
    g.position.set(d.x, st.lift, d.z);
    g.rotation.set(0, d.yaw + st.spin, -st.tip, 'YXZ');
    const thinForward = st.thin < 1 && frame.course !== null && crushAlongForward(frame.course, frame.movers, d.x, d.z, d.yaw + st.spin);
    g.scale.set(st.spread * (thinForward ? st.thin : 1), st.squash, st.spread * (thinForward ? 1 : st.thin));
    rig.poser.apply(pose);
    mats.apply(pose, st.lift, clock.elapsedTime);
    if (st.grey > 0) mats.body.color.lerp(GREY, st.grey);
    if (st.flash > 0) mats.body.color.lerp(st.thin < 1 ? CRUSH_FLASH : FLASH, st.flash * 0.55);
    if (shadow.current) {
      shadow.current.visible = blob && Math.abs(st.tip) < 0.3;
      shadow.current.position.y = -st.lift;
    }
    if (ring.current) {
      // The ring stays flat on the floor whatever the body does, and dims once the run is over.
      ring.current.visible = Math.abs(st.tip) < 0.2 && st.squash > 0.9;
      ring.current.position.y = -st.lift;
      ringMat.uniforms.uStrength.value = st.alpha * (st.grey > 0 ? 0.5 : 1);
      ringMat.uniforms.uTime.value = clock.elapsedTime;
    }
  }, POSE_PRIORITY);

  return (
    <group ref={group}>
      <primitive object={rig.root} />
      <primitive object={rig.body} />
      <primitive object={rig.face} />
      <primitive object={rig.ghost} />
      <mesh ref={shadow} geometry={kit.blob} material={mats.blob} renderOrder={1} raycast={() => null} />
      <mesh ref={ring} geometry={kit.ring} material={ringMat} renderOrder={2} raycast={() => null} />
    </group>
  );
}
