'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { LIGHT_FLASHING, LIGHT_GREEN, LIGHT_RED, LIGHT_YELLOW, WALK_FLASHING, WALK_GO } from '@/engine/driving/signals/plan';
import { useDisposable } from '@/render/shared/useDisposable';
import { useDrivingScene } from '../../frame/sceneContext';
import { TIERS } from '../../quality';
import { withHaze } from '../../world/atmosphere';
import { glowTexture } from './glow';
import { Instances } from './Instances';
import { HEAD_HEIGHT, NEAR_HEIGHT, type Spot, type Streetscape } from './layout';
import { armGeometry, LAMP_X, LAMP_Y, lampGeometry, poleGeometry, signalHeadGeometry, walkFaceGeometry, walkHeadGeometry } from './signalGeometry';

/** Lit and dark lamp colors, linear, past 1 so High's bloom catches the lit ones. */
const LIT = [new THREE.Color(5, 0.1, 0.04), new THREE.Color(5, 1.9, 0.04), new THREE.Color(0.08, 4.2, 1.3)];
const DARK = [new THREE.Color(0.09, 0.015, 0.01), new THREE.Color(0.09, 0.06, 0.01), new THREE.Color(0.01, 0.07, 0.04)];
const WALK_WHITE = new THREE.Color(3.2, 3.2, 3);
const WALK_HAND = new THREE.Color(4, 1.3, 0.15);

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const s = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** A matrix at a spot, `h` up, scaled by (sx, sy, sz) in the spot's own frame. */
function at(spot: Spot, h: number, sx = 1, sy = 1, sz = 1, yaw = spot.heading): THREE.Matrix4 {
  return m.compose(p.set(spot.x, h, -spot.y), q.setFromAxisAngle(Y, yaw), s.set(sx, sy, sz));
}

/** Which lamp is lit for a light state (0 red, 1 yellow, 2 green), or -1 for none. */
function litLamp(state: number, blink: boolean): number {
  if (state === LIGHT_RED) return 0;
  if (state === LIGHT_YELLOW) return 1;
  if (state === LIGHT_GREEN) return 2;
  if (state === LIGHT_FLASHING) return blink ? 1 : -1;
  return -1;
}

/** Writes one glow card in front of lit lamp `k` of the head at `spot`. */
function glowAt(pos: THREE.BufferAttribute, col: THREE.BufferAttribute, n: number, spot: Spot, h: number, k: number, strength: number): void {
  const c = Math.cos(spot.heading);
  const sn = Math.sin(spot.heading);
  pos.setXYZ(n, spot.x + c * (LAMP_X + 0.05), h + LAMP_Y[k], -(spot.y + sn * (LAMP_X + 0.05)));
  col.setXYZ(n, (LIT[k].r / 5) * strength, (LIT[k].g / 5) * strength, (LIT[k].b / 5) * strength);
}

/**
 * Every traffic signal and walk signal in the city. Poles, mast arms and
 * housings are static instances; each lamp is an instanced disc whose
 * color follows the world's lights every frame, with a soft glow card on
 * the lit ones (bloom does the rest on High).
 */
export function Signals({ street }: { street: Streetscape }) {
  const { frame, tier } = useDrivingScene();
  const lamps = useRef<Array<THREE.InstancedMesh | null>>([]);
  const faces = useRef<THREE.InstancedMesh>(null);
  const glow = useRef<THREE.Points>(null);
  const heads = street.signals.length * 2;
  const built = useDisposable(() => {
    const parts = { pole: poleGeometry(0.09), arm: armGeometry(), head: signalHeadGeometry(), walk: walkHeadGeometry(), lamp: lampGeometry(), face: walkFaceGeometry(), glowGeo: new THREE.BufferGeometry() };
    parts.glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(heads * 3), 3).setUsage(THREE.DynamicDrawUsage));
    parts.glowGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(heads * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const metal = withHaze(new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.55, metalness: 0.6 }));
    const housing = withHaze(new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.6, metalness: 0.3 }));
    const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const tex = glowTexture();
    const glowMat = new THREE.PointsMaterial({ size: 1.3, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, toneMapped: false, sizeAttenuation: true });
    const all = [...Object.values(parts), metal, housing, lampMat, glowMat, tex];
    return { ...parts, metal, housing, lampMat, glowMat, dispose: () => all.forEach((x) => x.dispose()) };
  }, [heads]);

  // Static instances: poles, arms and housings, placed once.
  const statics = useMemo(() => {
    const poles: THREE.Matrix4[] = [];
    const arms: THREE.Matrix4[] = [];
    const housings: THREE.Matrix4[] = [];
    const walkBoxes: THREE.Matrix4[] = [];
    for (const sg of street.signals) {
      const reach = Math.hypot(sg.head.x - sg.pole.x, sg.head.y - sg.pole.y);
      const toward = Math.atan2(sg.head.y - sg.pole.y, sg.head.x - sg.pole.x);
      poles.push(at(sg.pole, 0, 1, HEAD_HEIGHT + 1.1, 1).clone());
      arms.push(at(sg.pole, HEAD_HEIGHT + 0.72, reach + 0.25, 1, 1, toward).clone());
      housings.push(at(sg.head, HEAD_HEIGHT).clone(), at(sg.near, NEAR_HEIGHT).clone());
    }
    for (const w of street.walks) {
      poles.push(at(w, 0, 0.7, 2.9, 0.7).clone());
      walkBoxes.push(at(w, 2.55).clone());
    }
    return { poles, arms, housings, walkBoxes };
  }, [street]);

  useFrame((state) => {
    const world = frame.world;
    if (!world) return;
    const blink = Math.floor(state.clock.elapsedTime * 1.6) % 2 === 0;
    const pos = built.glowGeo.attributes.position as THREE.BufferAttribute;
    const col = built.glowGeo.attributes.color as THREE.BufferAttribute;
    const strength = TIERS[tier].glowCards;
    let lit = 0;
    for (let i = 0; i < street.signals.length; i++) {
      const sg = street.signals[i];
      const k = litLamp(world.lights[sg.signal * 4 + sg.dir], blink);
      for (let lamp = 0; lamp < 3; lamp++) {
        const mesh = lamps.current[lamp];
        if (!mesh) continue;
        const c = lamp === k ? LIT[lamp] : DARK[lamp];
        mesh.setColorAt(i * 2, c);
        mesh.setColorAt(i * 2 + 1, c);
      }
      if (k < 0) continue;
      glowAt(pos, col, lit++, sg.head, HEAD_HEIGHT, k, strength);
      glowAt(pos, col, lit++, sg.near, NEAR_HEIGHT, k, strength);
    }
    for (let lamp = 0; lamp < 3; lamp++) {
      const mesh = lamps.current[lamp];
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    built.glowGeo.setDrawRange(0, lit);
    pos.needsUpdate = col.needsUpdate = true;
    const f = faces.current;
    if (f) {
      for (let i = 0; i < street.walks.length; i++) {
        const w = street.walks[i];
        const v = world.walks[w.signal * 2 + w.axis];
        f.setColorAt(i, v === WALK_GO ? WALK_WHITE : v === WALK_FLASHING && !blink ? DARK[1] : WALK_HAND);
      }
      if (f.instanceColor) f.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <Instances geometry={built.pole} material={built.metal} matrices={statics.poles} shadows={tier !== 'low'} />
      <Instances geometry={built.arm} material={built.metal} matrices={statics.arms} shadows={tier !== 'low'} />
      <Instances geometry={built.head} material={built.housing} matrices={statics.housings} shadows={tier !== 'low'} />
      <Instances geometry={built.walk} material={built.housing} matrices={statics.walkBoxes} shadows={false} />
      {[0, 1, 2].map((lamp) => (
        <Instances key={lamp} geometry={built.lamp} material={built.lampMat} matrices={statics.housings} offset={[LAMP_X + 0.002, LAMP_Y[lamp], 0]} meshRef={(el) => void (lamps.current[lamp] = el)} colored />
      ))}
      <Instances geometry={built.face} material={built.lampMat} matrices={statics.walkBoxes} offset={[0.104, 0, 0]} meshRef={(el) => void (faces.current = el)} colored />
      <points ref={glow} geometry={built.glowGeo} material={built.glowMat} frustumCulled={false} renderOrder={3} />
    </group>
  );
}

