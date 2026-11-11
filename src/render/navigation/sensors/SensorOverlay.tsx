'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { NAV_RUNNING, RAY_MOVER, RAY_NONE, RAY_SPIKES } from '@/engine/navigation/agent';
import { sampleFlow } from '@/engine/navigation/course/fieldSample';
import { navRayAngles } from '@/engine/navigation/sensors/inputConfig';
import { castRay, type RayHit, type RayWorld } from '@/engine/navigation/sensors/raycast';
import { SNAP_STATUS } from '@/engine/navigation/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { POSE_PRIORITY, useNavScene } from '../frame/sceneContext';
import { STRIDE } from '../frame/snapshotRead';
import { NAV_COLORS } from '../palette';
import { SENSE_Y, SensorDrawing } from './sensorDrawing';
import { SensorFan } from './sensorFan';
import { StreamedInputs } from './streamedInputs';

const COLORS = {
  solid: new THREE.Color(NAV_COLORS.senseSolid),
  spikes: new THREE.Color(NAV_COLORS.senseSpikes),
  mover: new THREE.Color(NAV_COLORS.senseMover),
  hint: new THREE.Color(NAV_COLORS.pathHint),
  goal: new THREE.Color(NAV_COLORS.goalArrow),
};
/** The path hint trail: dots this far apart, m, this many of them, drifting forward this fast, m/s. */
const DOT_STEP = 0.45;
const DOTS = 14;
const DRIFT = 0.9;
/** How far ahead of the runner the goal arrow sits, m. */
const ARROW_AHEAD = 1.7;

/**
 * What the followed runner senses, drawn in the scene: soft beams to what
 * each ray meets with a marker colored by what it is (walls and crates,
 * spikes, movers), an arrow on the floor toward the finish, and the path
 * hint as a trail of dots drifting along the shortest way round. Where
 * the feed streams the runner's inputs (the lab does), the beams and the
 * arrow show those, blended between ticks so they glide; a lesioned or
 * noisy input shows as the brain saw it. Without them the rays are cast
 * again here from the blended pose with the engine's own code.
 */
export function SensorOverlay() {
  const { frame, view } = useNavScene();
  const draw = useDisposable(() => new SensorDrawing(), []);
  const fan = useDisposable(() => new SensorFan(), []);
  const t = useMemo(() => ({ movers: new Float64Array(64), hit: { distance: 0, kind: 0 } as RayHit, flow: { x: 0, z: 0 }, angles: new Float64Array(0), key: -1, obs: new StreamedInputs() }), []);

  useFrame(({ size, clock }) => {
    const course = frame.course;
    const inputs = frame.feed?.inputs;
    const curr = frame.curr;
    const i = frame.leader;
    if (!view.sensors || !course || !inputs || !curr || i < 0 || curr[i * STRIDE + SNAP_STATUS] !== NAV_RUNNING) {
      frame.rays = 0;
      fan.hide();
      return draw.hide();
    }
    const rays = inputs.rays;
    const key = rays.count * 1000 + Math.round(rays.fov * 100);
    if (key !== t.key) {
      t.key = key;
      t.angles = Float64Array.from(navRayAngles(rays.count, rays.fov));
    }
    for (let k = 0; k < course.movers.length && k < 16; k++) {
      t.movers[k * 4] = frame.movers[k * 2];
      t.movers[k * 4 + 1] = frame.movers[k * 2 + 1];
      t.movers[k * 4 + 2] = course.movers[k].hx;
      t.movers[k * 4 + 3] = course.movers[k].hz;
    }
    const world: RayWorld = worldOf(course, t.movers);
    const { x, z, yaw } = frame.leaderPose;
    draw.begin(size.height);
    fan.begin(x, z, rays.fov >= Math.PI * 2 - 1e-6);
    const hovered = view.hoveredInput;
    const n = t.angles.length;
    const hoveredRay = hovered < 0 ? -1 : hovered < n ? hovered : rays.hitTypes && hovered < n * 3 ? hovered % n : -1;
    // What the brain received, when the feed streams it for this runner; else the rays are cast again here.
    const streamed = t.obs.take(frame.feed?.inspect, i, n * (rays.hitTypes ? 3 : 1) + (inputs.goal ? 2 : 0));
    for (let r = 0; r < n; r++) {
      const a = yaw + t.angles[r];
      if (streamed) t.obs.ray(r, n, rays.range, rays.hitTypes, frame.alpha, t.hit);
      else castRay(world, x, z, Math.cos(a), -Math.sin(a), rays.range, t.hit);
      const kind = t.hit.kind;
      const color = kind === RAY_SPIKES ? COLORS.spikes : kind === RAY_MOVER ? COLORS.mover : COLORS.solid;
      draw.beam(x, z, a, t.hit.distance, color, kind !== RAY_NONE, r === hoveredRay);
      fan.ray(x + Math.cos(a) * t.hit.distance, z - Math.sin(a) * t.hit.distance, t.hit.distance);
      if (kind !== RAY_NONE) draw.hit(x + Math.cos(a) * t.hit.distance, SENSE_Y, z - Math.sin(a) * t.hit.distance, color);
    }
    if (inputs.goal) {
      // The finish bearing as the brain read it (left positive, over pi), or straight down the room.
      const g = streamed ? yaw + t.obs.value(n * (rays.hitTypes ? 3 : 1), frame.alpha) * Math.PI : 0;
      draw.goal(x + Math.cos(g) * ARROW_AHEAD, z - Math.sin(g) * ARROW_AHEAD, g, 0.85, COLORS.goal);
    } else draw.goal(0, 0, 0, 0, COLORS.goal);
    frame.rays = n;
    if (inputs.pathHint) {
      // Walk the field from the runner; dots drift forward and fade in at the start and out at the end.
      const phase = (clock.elapsedTime * DRIFT) % DOT_STEP;
      let px = x;
      let pz = z;
      let walked = 0;
      for (let d = 0; d < DOTS; d++) {
        const target = 0.55 + phase + d * DOT_STEP;
        while (walked < target) {
          sampleFlow(course.field, px, pz, t.flow);
          px += t.flow.x * 0.15;
          pz += t.flow.z * 0.15;
          walked += 0.15;
        }
        if (px > course.finishX + 0.3) break;
        const u = target / (0.55 + DOTS * DOT_STEP);
        draw.dot(px, pz, 0.17 * (1 - u * 0.45), Math.min(1, (target - 0.55) / 0.4) * (1 - u) * 0.9, COLORS.hint);
      }
    }
    draw.end();
    fan.end();
  }, POSE_PRIORITY);

  return (
    <group>
      <primitive object={fan.mesh} />
      <primitive object={draw.group} />
    </group>
  );
}

/** A ray world over the course's own packed solids and spikes and the movers where they stand this frame. Plain object, made without allocating arrays. */
function worldOf(course: NonNullable<ReturnType<typeof useNavScene>['frame']['course']>, movers: Float64Array): RayWorld {
  scratchWorld.solids = course.solidData;
  scratchWorld.solidCount = course.solids.length;
  scratchWorld.spikes = course.spikeData;
  scratchWorld.spikeCount = course.spikes.length;
  scratchWorld.movers = movers;
  scratchWorld.moverCount = Math.min(16, course.movers.length);
  return scratchWorld;
}

const scratchWorld: RayWorld = { solids: new Float64Array(0), solidCount: 0, spikes: new Float64Array(0), spikeCount: 0, movers: new Float64Array(0), moverCount: 0 };
