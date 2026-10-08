'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { Particles } from './effects/particles';
import { SkidMarks } from './effects/skidMarks';
import { SURFACE } from './motion/wheelContact';
import { useRacingScene } from './sceneContext';
import { detailNoise, releaseDetailNoise } from './world/detailNoise';
import { smoothstep as smooth } from './world/noise';

/**
 * Tire smoke, rubber marks, dust and flying grit for the followed car, all
 * from what it really did: tires lay rubber and smoke when the car uses
 * nearly all its grip (rears when it slides, fronts when it pushes wide),
 * and a wheel off the road throws up dust and grit or grass. Cosmetic only.
 */
export function TireEffects() {
  const { frame, track, population, ghosts } = useRacingScene();
  const fx = useDisposable(() => {
    const noise = detailNoise();
    const marks = new SkidMarks();
    const puffs = new Particles(360, noise);
    const kinds = {
      smoke: puffs.kind({ color: new THREE.Color(0.86, 0.87, 0.88), life: 2.6, size0: 0.7, size1: 4.6, alpha: 0.42, lift: 0.35, drag: 0.9, soft: 1 }),
      dust: puffs.kind({ color: new THREE.Color(0.62, 0.52, 0.38), life: 3.2, size0: 0.9, size1: 5.5, alpha: 0.38, lift: 0.15, drag: 1.1, soft: 1 }),
      haze: puffs.kind({ color: new THREE.Color(0.55, 0.53, 0.38), life: 2.4, size0: 0.6, size1: 3.6, alpha: 0.28, lift: 0.2, drag: 1.2, soft: 1 }),
      grit: puffs.kind({ color: new THREE.Color(0.32, 0.27, 0.2), life: 0.9, size0: 0.07, size1: 0.05, alpha: 1, lift: -9.8, drag: 0.4, soft: 0 }),
      blade: puffs.kind({ color: new THREE.Color(0.26, 0.3, 0.1), life: 0.8, size0: 0.09, size1: 0.06, alpha: 1, lift: -7, drag: 0.8, soft: 0 }),
    };
    return { marks, puffs, kinds, dispose: () => (marks.dispose(), puffs.dispose(), releaseDetailNoise()) };
  }, []);
  const s = useMemo(() => ({ now: 0, last: new Float32Array(8), active: new Uint8Array(4), emit: new Float32Array(8), owner: -1, epoch: -1 }), []);
  // Rubber laid on another track has no business on this one.
  useEffect(() => fx.marks.clear(), [fx, track]);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    s.now += dt;
    fx.marks.material.uniforms.uNow.value = s.now;
    const speed = frame.focusSpeed;
    const m = frame.motion;
    const c = frame.contact;
    const fwdX = Math.cos(frame.focusYaw);
    const fwdZ = -Math.sin(frame.focusYaw);
    const moving = frame.focusIndex >= 0 && speed > 1.5;
    // A different car, or a new episode: no strip may join the old wheel to the new one, and a restart starts clean.
    if (frame.contactOwner !== s.owner) {
      s.owner = frame.contactOwner;
      s.active.fill(0);
      s.emit.fill(0);
    }
    const stream = frame.focusStream === 'ghosts' ? ghosts : population;
    if (stream && stream.epoch !== s.epoch) {
      s.epoch = stream.epoch;
      s.active.fill(0);
      fx.marks.clear();
    }
    const slide = smooth(0.86, 1.04, m.usage) * smooth(5, 12, speed);
    const push = smooth(0.12, 0.45, m.push) * smooth(6, 14, speed);
    for (let w = 0; w < 4; w++) {
      const x = c.at[w * 2];
      const z = c.at[w * 2 + 1];
      const surf = c.surface[w];
      const road = surf === SURFACE.asphalt || surf === SURFACE.kerb;
      const grip = !moving || !road ? 0 : w >= 2 ? slide : Math.max(push, slide * 0.6);
      // Rubber: a continuous strip while the tire is sliding, laid every quarter meter.
      if (grip > 0.08) {
        const lx = s.last[w * 2];
        const lz = s.last[w * 2 + 1];
        // More than 2 m since the last point is a jump, not a slide: start a fresh strip here.
        if (!s.active[w] || (x - lx) ** 2 + (z - lz) ** 2 > 4) {
          s.active[w] = 1;
          s.last[w * 2] = x;
          s.last[w * 2 + 1] = z;
        } else if ((x - lx) ** 2 + (z - lz) ** 2 > 0.0625) {
          fx.marks.add(lx, lz, x, z, 0.2 + 0.6 * grip, s.now);
          s.last[w * 2] = x;
          s.last[w * 2 + 1] = z;
        }
      } else s.active[w] = 0;
      // Smoke trails behind at a share of the car's speed, drifting and swelling as it rises.
      s.emit[w * 2] += grip * 34 * dt;
      for (; s.emit[w * 2] >= 1; s.emit[w * 2]--) {
        const r = Math.random();
        fx.puffs.spawn(fx.kinds.smoke, x, 0.3, z, fwdX * speed * 0.3 + (Math.random() - 0.5) * 1.2, 0.4 + r * 0.5, fwdZ * speed * 0.3 + (Math.random() - 0.5) * 1.2, r);
      }
      // Off the road: a wake of dust, and grit or clippings flung back and up off the tire.
      const off = moving && !road ? Math.min(1, speed / 18) : 0;
      s.emit[w * 2 + 1] += off * 60 * dt;
      for (; s.emit[w * 2 + 1] >= 1; s.emit[w * 2 + 1]--) {
        const r = Math.random();
        const gravel = surf === SURFACE.gravel;
        if (r < 0.4) fx.puffs.spawn(gravel ? fx.kinds.dust : fx.kinds.haze, x, 0.25, z, -fwdX * speed * 0.12 + (Math.random() - 0.5), 0.6 + r, -fwdZ * speed * 0.12 + (Math.random() - 0.5), r);
        else fx.puffs.spawn(gravel ? fx.kinds.grit : fx.kinds.blade, x, 0.15, z, -fwdX * speed * 0.35 + (Math.random() - 0.5) * 3, 2 + r * 3, -fwdZ * speed * 0.35 + (Math.random() - 0.5) * 3, r);
      }
    }
    fx.marks.flush();
    fx.puffs.update(dt, camera.position);
  });

  return (
    <group>
      <primitive object={fx.marks.mesh} />
      <primitive object={fx.puffs.mesh} />
    </group>
  );
}
