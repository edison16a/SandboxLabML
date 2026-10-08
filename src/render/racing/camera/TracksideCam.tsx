'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { stepSpring } from '@/render/shared/interpolate';
import { useRacingScene } from '../sceneContext';
import { FRAME_PRIORITY } from '../framePriority';
import type { WorldData } from '../world/worldData';
import { pickStation, trackStations } from './stations';

/** How big the car should stay in frame: the half height of view, m, at the car. */
const FRAMING = 6.5;

/**
 * A cinematic trackside view, like race coverage on TV: fixed cameras on
 * short towers round the circuit, each panning to follow the car with a
 * long lens that zooms to keep it the same size, cutting to the next camera
 * once the car has gone by. The aim leads the car a little and eases into
 * each change of direction, like a hand on a tripod. The ease works on
 * the aim's offset from the car, so at any playback speed the car stays
 * in frame instead of the long lens trailing behind it.
 */
export function TracksideCam({ world, target }: { world: WorldData | null; target: React.RefObject<THREE.Vector3> }) {
  const { frame, track } = useRacingScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const stations = useMemo(() => (world ? trackStations(world) : []), [world]);
  const rig = useMemo(() => ({ station: -1, x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, look: new THREE.Vector3() }), []);

  useFrame((_, rawDt) => {
    // Only a real stall is clamped, so the pan keeps up with the car even at a low frame rate.
    const dt = Math.min(rawDt, 1);
    const focus = frame.focusPos;
    target.current?.copy(focus);
    if (!stations.length) return;
    // The car's own place on the road, found fresh each frame, so a jump never leaves the director on a stale camera.
    const next = pickStation(stations, rig.station, frame.contact.s, track.length);
    const st = stations[next];
    if (next !== rig.station) {
      // A cut: snap the pan straight onto the car, as a director would.
      rig.station = next;
      rig.x.value = rig.z.value = 0;
      rig.y.value = 0.9;
      rig.x.velocity = rig.y.velocity = rig.z.velocity = 0;
    }
    camera.position.set(st.x, st.y, st.z);
    // Lead the car a little in the direction it travels, so it drives into the frame.
    const lead = frame.focusSpeed * 0.18;
    rig.look.set(
      focus.x + stepSpring(rig.x, Math.cos(frame.focusYaw) * lead, 7, dt),
      stepSpring(rig.y, 0.9, 7, dt),
      focus.z + stepSpring(rig.z, -Math.sin(frame.focusYaw) * lead, 7, dt),
    );
    camera.lookAt(rig.look);
    const dist = camera.position.distanceTo(focus);
    const fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(FRAMING / Math.max(1, dist))), 6, 55);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, FRAME_PRIORITY.camera);
  return null;
}
