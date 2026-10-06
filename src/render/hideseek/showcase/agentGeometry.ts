import * as THREE from 'three';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';

const A = DEFAULT_HIDESEEK_PHYSICS.agent;
/** Height of the visor's center, m: eye level, kept on the straight part of the capsule so the band sits flush. */
export const VISOR_Y = A.height - A.radius - 0.12;
const VISOR_ARC = Math.PI * 0.72;

/** The body: a smooth capsule standing on the floor, its base at y = 0. */
export function bodyGeometry(): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(A.radius, A.height - 2 * A.radius, 12, 40, 1);
  g.translate(0, A.height / 2, 0);
  return g;
}

/**
 * A band wrapped round the front of the body, centered on +x (the facing
 * direction). three measures cylinder angles from +z toward +x, so the arc
 * is centered on a quarter turn.
 */
function frontBand(radius: number, height: number, y: number, arc: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, Math.PI / 2 - arc / 2, arc);
  g.translate(0, y, 0);
  return g;
}

/** Dark glass visor across the face. It is what shows which way an agent faces. */
export function visorGeometry(): THREE.BufferGeometry {
  return frontBand(A.radius + 0.012, 0.17, VISOR_Y, VISOR_ARC);
}

/** A thin glowing line in the middle of the visor, in team color. */
export function visorLineGeometry(): THREE.BufferGeometry {
  return frontBand(A.radius + 0.017, 0.028, VISOR_Y, VISOR_ARC * 0.92);
}

/** A glowing ring round the waist, in team color. */
export function waistRingGeometry(): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(A.radius + 0.008, 0.016, 10, 72);
  g.rotateX(Math.PI / 2);
  g.translate(0, A.height * 0.42, 0);
  return g;
}

/** A faint ring on the floor round the agent, so it reads from straight above. */
export function baseRingGeometry(): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(A.radius + 0.12, A.radius + 0.2, 64);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.012, 0);
  return g;
}
