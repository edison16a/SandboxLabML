'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { LIGHT_RED } from '@/engine/driving/signals/plan';
import { pathPoint } from '@/engine/driving/geometry/path';
import type { Route } from '@/engine/driving/route/route';
import { useDisposable } from '@/render/shared/useDisposable';
import { HEAD_HEIGHT, streetscapeFor, type SignalSpot } from '../city/streetscape/layout';
import { FRAME_PRIORITY } from '../frame/FrameDriver';
import { useDrivingScene } from '../frame/sceneContext';
import { FatLines } from './fatLines';
import { lightColor } from './palette';

const Y = new THREE.Vector3(0, 1, 0);

/**
 * The signal the followed SUV is reading and the line it is aiming to stop
 * at. A frame in the light's own color hugs the signal head over the lane,
 * and a glowing bar lies across the lane at the stop line; while the light
 * is red and the car is closing in, the bar pulses.
 */
export function LightTarget({ route }: { route: Route }) {
  const { frame, city } = useDrivingScene();
  const bar = useRef<THREE.Mesh>(null);
  const heads = useMemo(() => {
    const map = new Map<number, SignalSpot>();
    for (const sg of streetscapeFor(city).signals) map.set(sg.signal * 4 + sg.dir, sg);
    return map;
  }, [city]);
  const built = useDisposable(() => {
    const geometry = new THREE.PlaneGeometry(0.55, 3.3).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const frameLines = new FatLines(16, 2.6);
    return { geometry, material, frameLines, dispose: () => (geometry.dispose(), material.dispose(), frameLines.dispose()) };
  }, []);
  const tmp = useMemo(() => ({ pt: pathPoint(), q: new THREE.Quaternion() }), []);

  useFrame(({ size, clock }) => {
    const s = frame.sense;
    const lines = built.frameLines;
    const b = bar.current;
    lines.begin();
    const p = s.perception;
    const on = s.valid && frame.focus >= 0 && p.light >= 0 && p.stop >= 0 && p.lightDistance < 70;
    if (b) b.visible = on;
    if (on && b) {
      const st = route.stops[p.stop];
      const c = lightColor(p.light);
      const close = p.light === LIGHT_RED && p.lightDistance < 30 ? 0.65 + 0.35 * Math.sin(clock.elapsedTime * 6) : 0.75;
      const pt = route.path.sample(st.s, tmp.pt);
      b.position.set(pt.x, 0.04, -pt.y);
      b.quaternion.copy(tmp.q.setFromAxisAngle(Y, Math.atan2(pt.ty, pt.tx)));
      built.material.color.copy(c).multiplyScalar(close * 0.7);
      // The head this approach shows: find the lane arriving at the stop line, then its signal.
      const lane = city.elements[route.elements[route.sampleElement[route.path.indexAt(st.s - 0.5)]]];
      const head = heads.get(p.signal * 4 + lane.dir);
      if (head) {
        const h = head.head;
        const fx = Math.cos(h.heading);
        const fz = -Math.sin(h.heading);
        const lx = -Math.sin(h.heading);
        const lz = -Math.cos(h.heading);
        const cx = h.x + fx * 0.32;
        const cz = -h.y + fz * 0.32;
        const w = 0.36;
        const top = HEAD_HEIGHT + 0.72;
        const bot = HEAD_HEIGHT - 0.72;
        const k = 0.9;
        lines.add(cx + lx * w, top, cz + lz * w, cx - lx * w, top, cz - lz * w, c, k);
        lines.add(cx + lx * w, bot, cz + lz * w, cx - lx * w, bot, cz - lz * w, c, k);
        lines.add(cx + lx * w, top, cz + lz * w, cx + lx * w, bot, cz + lz * w, c, k);
        lines.add(cx - lx * w, top, cz - lz * w, cx - lx * w, bot, cz - lz * w, c, k);
      }
    }
    lines.finish(size.width, size.height);
  }, FRAME_PRIORITY.overlay);

  return (
    <group>
      <mesh ref={bar} geometry={built.geometry} material={built.material} renderOrder={5} visible={false} />
      <primitive object={built.frameLines.object} renderOrder={8} />
    </group>
  );
}
