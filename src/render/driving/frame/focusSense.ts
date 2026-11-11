import { SUV_SIZE } from '@/engine/driving/car/params';
import type { City } from '@/engine/driving/city/types';
import { projection } from '@/engine/driving/geometry/path';
import type { Route } from '@/engine/driving/route/route';
import { lidarAngles, type DrivingInputConfig } from '@/engine/driving/sensors/inputConfig';
import { Lidar } from '@/engine/driving/sensors/lidar';
import { Nearby } from '@/engine/driving/sensors/nearby';
import { perceive, perception, type Perception, type RoutePose } from '@/engine/driving/sensors/perception';
import type { WorldState } from '@/engine/driving/world/state';

const MAX_BEAMS = 64;

/**
 * What the followed SUV senses this frame, worked out on the main thread
 * with the engine's own sensor code on the blended world. So the beams,
 * boxes and the light shown on screen are exactly what its brain reads,
 * and they move at display rate rather than in 30 Hz steps.
 */
export interface FocusSense {
  valid: boolean;
  beams: number;
  /** Beam angles relative to the car, and what each beam hit: distance, kind and the world index of a car or person. */
  angles: Float64Array;
  dist: Float64Array;
  kind: Uint8Array;
  hit: Int32Array;
  range: number;
  perception: Perception;
  near: Nearby;
  pose: RoutePose;
  lidar: Lidar | null;
  lidarKey: string;
}

export function focusSense(): FocusSense {
  return {
    valid: false,
    beams: 0,
    angles: new Float64Array(MAX_BEAMS),
    dist: new Float64Array(MAX_BEAMS),
    kind: new Uint8Array(MAX_BEAMS),
    hit: new Int32Array(MAX_BEAMS),
    range: 40,
    perception: perception(),
    near: new Nearby(),
    pose: { x: 0, y: 0, heading: 0, speed: 0, progress: 0, index: 0, half: SUV_SIZE.length / 2 },
    lidar: null,
    lidarKey: '',
  };
}

const proj = projection();

/**
 * Senses for a SUV at (x, y) facing `heading`. `hint` is last frame's
 * route sample, so the route projection stays a short windowed search.
 * Returns the route sample it found.
 */
export function senseFocus(sense: FocusSense, city: City, route: Route | null, world: WorldState, inputs: DrivingInputConfig, x: number, y: number, heading: number, speed: number, hint: number): number {
  const key = `${inputs.lidar.count}:${inputs.lidar.fov}`;
  if (!sense.lidar || sense.lidarKey !== key) {
    const angles = lidarAngles(Math.min(MAX_BEAMS, inputs.lidar.count), inputs.lidar.fov);
    sense.lidar = new Lidar(angles);
    sense.lidarKey = key;
    sense.angles.set(angles);
    sense.beams = angles.length;
    // A new beam layout means the stop line memory belongs to another setup.
    sense.perception.stop = -1;
  }
  sense.range = inputs.lidar.range;
  const near = sense.near.gather(world, x, y);
  sense.lidar.cast(city, world, near, x, y, heading, inputs.lidar.range, sense.dist, sense.kind, sense.hit);
  let index = hint;
  if (route) {
    route.path.project(x, y, hint, hint > 0 ? 16 : route.path.n, proj);
    index = proj.index;
    const p = sense.pose;
    p.x = x;
    p.y = y;
    p.heading = heading;
    p.speed = speed;
    p.progress = proj.s;
    p.index = proj.index;
    perceive(city, route, world, near, p, sense.perception);
  }
  sense.valid = true;
  return index;
}
