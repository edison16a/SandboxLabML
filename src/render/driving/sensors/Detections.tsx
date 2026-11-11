'use client';

import type * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { HIT_CAR, HIT_PED } from '@/engine/driving/sensors/lidar';
import { MAX_PEDS, MAX_TRAFFIC } from '@/engine/driving/world/state';
import { useDisposable } from '@/render/shared/useDisposable';
import { FRAME_PRIORITY } from '../frame/FrameDriver';
import { useDrivingScene } from '../frame/sceneContext';
import { BODY } from '../suv/dimensions';
import { FatLines } from './fatLines';
import { SENSOR, SENSOR_CSS } from './palette';
import { TextLabel } from './TextLabel';

const MAX_BOXES = 18;
/** Corner bracket arms as a share of each box edge, capped in meters. */
const ARM = 0.26;
const ARM_MAX = 0.7;

/** Eight corner brackets of an oriented box, three short arms each, pointing along its edges. */
function bracketBox(lines: FatLines, cx: number, cz: number, h: number, hl: number, hw: number, y0: number, y1: number, c: THREE.Color, k: number): void {
  const fx = Math.cos(h);
  const fz = -Math.sin(h);
  const lx = -Math.sin(h);
  const lz = -Math.cos(h);
  const al = Math.min(ARM_MAX, 2 * hl * ARM);
  const aw = Math.min(ARM_MAX, 2 * hw * ARM);
  const ay = Math.min(ARM_MAX, (y1 - y0) * ARM);
  for (let corner = 0; corner < 8; corner++) {
    const sx = corner & 1 ? 1 : -1;
    const sz = corner & 2 ? 1 : -1;
    const top = corner & 4 ? 1 : 0;
    const x = cx + fx * sx * hl + lx * sz * hw;
    const z = cz + fz * sx * hl + lz * sz * hw;
    const y = top ? y1 : y0;
    lines.add(x, y, z, x - fx * sx * al, y, z - fz * sx * al, c, k);
    lines.add(x, y, z, x - lx * sz * aw, y, z - lz * sz * aw, c, k);
    lines.add(x, y, z, x, y + (top ? -ay : ay), z, c, k);
  }
}

/** Distance from the followed SUV's front bumper to a thing of half length `half` at (x, z), roughly. */
function clearance(fx: number, fz: number, x: number, z: number, half: number): number {
  return Math.max(0, Math.hypot(x - fx, z - fz) - BODY.length / 2 - half);
}

/**
 * What the followed SUV currently senses, boxed: corner brackets round
 * every car its lidar touches and the car ahead it tracks (amber), and
 * round every person (magenta). The nearest one gets a small distance
 * label. Brighter boxes are the ones its dedicated sensors report.
 */
export function Detections() {
  const { frame } = useDrivingScene();
  const lines = useDisposable(() => new FatLines(MAX_BOXES * 24, 2.2), []);
  const label = useDisposable(() => new TextLabel(), []);
  const marks = useMemo(() => ({ cars: new Uint8Array(MAX_TRAFFIC), peds: new Uint8Array(MAX_PEDS) }), []);

  useFrame(({ size }) => {
    const s = frame.sense;
    const world = frame.world;
    lines.begin();
    let best = Infinity;
    let bx = 0;
    let by = 0;
    let bz = 0;
    let bKind = -1;
    if (s.valid && world && frame.focus >= 0) {
      marks.cars.fill(0);
      marks.peds.fill(0);
      for (let i = 0; i < s.beams; i++) {
        if (s.kind[i] === HIT_CAR && s.hit[i] >= 0) marks.cars[s.hit[i]] = 1;
        if (s.kind[i] === HIT_PED && s.hit[i] >= 0) marks.peds[s.hit[i]] = 1;
      }
      if (s.perception.car >= 0) marks.cars[s.perception.car] = 2;
      if (s.perception.ped >= 0) marks.peds[s.perception.ped] = 2;
      let boxes = 0;
      for (let i = 0; i < world.carCount && boxes < MAX_BOXES; i++) {
        if (!marks.cars[i]) continue;
        const x = world.carX[i];
        const z = -world.carY[i];
        bracketBox(lines, x, z, world.carHeading[i], world.carLength[i] / 2 + 0.12, world.carWidth[i] / 2 + 0.12, 0.05, 1.55, SENSOR.car, marks.cars[i] === 2 ? 0.95 : 0.55);
        boxes++;
        const d = clearance(frame.pos.x, frame.pos.z, x, z, world.carLength[i] / 2);
        if (d < best) {
          best = d;
          bx = x;
          by = 1.9;
          bz = z;
          bKind = HIT_CAR;
        }
      }
      for (let i = 0; i < world.pedCount && boxes < MAX_BOXES; i++) {
        if (!marks.peds[i]) continue;
        const x = world.pedX[i];
        const z = -world.pedY[i];
        bracketBox(lines, x, z, world.pedHeading[i], 0.32, 0.32, 0.12, 1.95, SENSOR.person, marks.peds[i] === 2 ? 1.0 : 0.6);
        boxes++;
        const d = clearance(frame.pos.x, frame.pos.z, x, z, 0.3);
        if (d < best) {
          best = d;
          bx = x;
          by = 2.25;
          bz = z;
          bKind = HIT_PED;
        }
      }
    }
    lines.finish(size.width, size.height);
    label.sprite.visible = bKind >= 0;
    if (bKind < 0) return;
    label.sprite.position.set(bx, by, bz);
    label.set(`${Math.round(best)} m`, bKind === HIT_PED ? SENSOR_CSS.person : SENSOR_CSS.car);
  }, FRAME_PRIORITY.overlay);

  return (
    <group>
      <primitive object={lines.object} renderOrder={8} />
      <primitive object={label.sprite} />
    </group>
  );
}
