'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { DRIVING_SNAPSHOT, SNAP } from '@/engine/driving/snapshot';
import { blendField, blendPose, type Pose } from '@/render/shared/interpolate';
import { readTickMotion } from '../motion/tickMotion';
import { simToWorld } from '../space';
import { senseFocus } from './focusSense';
import { pickLeader } from './leader';
import { useDrivingScene } from './sceneContext';
import { WorldBlend } from './worldBlend';

const STRIDE = DRIVING_SNAPSHOT.stride;

/** Frame callbacks run in this order: the driver first, then the camera, then everything that reads the camera. */
export const FRAME_PRIORITY = { driver: -100, camera: -50, overlay: -10 } as const;

/**
 * Runs first every frame. It picks the SUV to follow (the chosen one, or
 * a sticky leader), blends its pose and the city's life for this frame,
 * reads its accelerations off the last two snapshots for the body motion,
 * and runs its sensors on the blended world for the overlay.
 */
export function FrameDriver() {
  const { city, route, car, inputs, population, world, view, frame } = useDrivingScene();
  const blendWorld = useMemo(() => new WorldBlend(city.signals.length), [city]);
  const seen = useMemo(() => ({ epoch: Number.NaN, focus: -2, motionFocus: -1, pose: { x: 0, y: 0, heading: 0 } as Pose }), []);

  useFrame(() => {
    frame.world = blendWorld.update(world);
    const curr = population?.curr;
    if (!population || !curr || population.count === 0) {
      frame.focus = -1;
      frame.sense.valid = false;
      // Nobody driving yet: stand at the start of the route, so the cameras frame where the first trip begins.
      if (route) {
        const p = route.path;
        const i = p.indexAt(route.startS);
        simToWorld(p.x[i], p.y[i], frame.pos);
        frame.yaw = Math.atan2(p.ty[i], p.tx[i]);
        frame.speed = 0;
      }
      return;
    }
    if (population.epoch !== seen.epoch) {
      seen.epoch = population.epoch;
      frame.leader = -1;
      frame.epoch++;
      frame.routeIndex = 0;
      frame.sense.perception.stop = -1;
    }
    frame.leader = pickLeader(curr.buffer, population.count, frame.leader);
    const focus = view.focus >= 0 && view.focus < population.count ? view.focus : frame.leader;
    if (focus !== seen.focus) {
      seen.focus = focus;
      frame.routeIndex = 0;
      frame.sense.perception.stop = -1;
    }
    frame.focus = focus;
    if (focus < 0) return;
    const prev = population.prev?.buffer ?? null;
    const a = population.alpha();
    const o = focus * STRIDE;
    const pose = blendPose(prev, curr.buffer, o, a, seen.pose);
    simToWorld(pose.x, pose.y, frame.pos);
    frame.yaw = pose.heading;
    frame.speed = blendField(prev, curr.buffer, o + SNAP.speed, a);
    frame.steer = blendField(prev, curr.buffer, o + SNAP.steer, a);
    frame.pedal = curr.buffer[o + SNAP.pedal];
    frame.status = curr.buffer[o + SNAP.status];
    frame.flags = curr.buffer[o + SNAP.flags];
    frame.progress = blendField(prev, curr.buffer, o + SNAP.progress, a);
    // Accelerations once per snapshot, from the two latest ticks.
    const tick = population.curr?.tick ?? 0;
    if (prev && (tick !== frame.motionTick || focus !== seen.motionFocus)) {
      readTickMotion(prev, curr.buffer, o, tick - (population.prev?.tick ?? tick - 1), car, frame.motion);
      frame.motionTick = tick;
      seen.motionFocus = focus;
    }
    if (frame.world) frame.routeIndex = senseFocus(frame.sense, city, route, frame.world, inputs, pose.x, pose.y, pose.heading, frame.speed, frame.routeIndex);
  }, FRAME_PRIORITY.driver);
  return null;
}
