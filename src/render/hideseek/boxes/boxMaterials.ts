import * as THREE from 'three';
import type { BoxKind } from '@/engine/hideseek/physics';
import { HS_COLORS } from '../palette';
import { hologramMaterial } from './padlock';

/** Crate colors. The panel colors live in the palette, so the room maps draw crates in the same gold. */
export const BOX_LOOK = {
  cube: HS_COLORS.cube,
  plank: HS_COLORS.plank,
  ramp: HS_COLORS.ramp,
  brace: '#f5f1e8',
  /** Braces of a locked crate take the color of the team that owns the lock, like the padlock over it. */
  lockedBrace: '#cfeaff',
  lockGlow: HS_COLORS.hider,
  seekerLockedBrace: '#ffd9dd',
  seekerLockGlow: HS_COLORS.seeker,
} as const;

const BRACE = new THREE.Color(BOX_LOOK.brace);
/** Locked brace and glow colors by owner team: 0 hiders, 1 seekers. */
const LOCKED_BRACE = [new THREE.Color(BOX_LOOK.lockedBrace), new THREE.Color(BOX_LOOK.seekerLockedBrace)];
const LOCK_GLOW = [new THREE.Color(BOX_LOOK.lockGlow), new THREE.Color(BOX_LOOK.seekerLockGlow)];

/**
 * The materials of one crate: lacquered gold panels, a light frame and the
 * padlock hologram. Each crate has its own, because locking animates them
 * one crate at a time.
 */
export class BoxMaterials {
  readonly panel: THREE.MeshStandardMaterial;
  readonly brace: THREE.MeshStandardMaterial;
  readonly lockBody: THREE.ShaderMaterial;
  readonly lockShackle: THREE.ShaderMaterial;
  readonly blob: THREE.MeshBasicMaterial;

  constructor(kind: BoxKind, full: boolean, blobMap: THREE.Texture) {
    const color = new THREE.Color(BOX_LOOK[kind]);
    this.panel = full
      ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.22, envMapIntensity: 1.1 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.2, envMapIntensity: 1.1 });
    this.brace = new THREE.MeshStandardMaterial({ color: BRACE.clone(), roughness: 0.34, metalness: 0, emissive: BRACE.clone(), emissiveIntensity: 0.06, envMapIntensity: 0.9 });
    this.lockBody = hologramMaterial(LOCK_GLOW[0], true);
    this.lockShackle = hologramMaterial(LOCK_GLOW[0], false);
    this.blob = new THREE.MeshBasicMaterial({ color: HS_COLORS.blobShadow, alphaMap: blobMap, transparent: true, opacity: 0.5, depthWrite: false });
  }

  /** `lock` runs 0 (free) to 1 (locked) through the lock animation. `owner` is the team that owns the lock, 0 hiders or 1 seekers. */
  apply(lock: number, time: number, owner: number): void {
    const glow = LOCK_GLOW[owner];
    this.brace.color.copy(BRACE).lerp(LOCKED_BRACE[owner], lock);
    this.brace.emissive.copy(BRACE).lerp(glow, lock);
    // Copied in place: this runs every frame for every crate.
    (this.lockBody.uniforms.uColor.value as THREE.Color).copy(glow);
    (this.lockShackle.uniforms.uColor.value as THREE.Color).copy(glow);
    this.brace.emissiveIntensity = 0.06 + lock * 0.7;
    // Set one by one: this runs every frame for every crate and must not allocate.
    this.lockBody.uniforms.uOpacity.value = lock;
    this.lockBody.uniforms.uTime.value = time;
    this.lockShackle.uniforms.uOpacity.value = lock;
    this.lockShackle.uniforms.uTime.value = time;
  }

  dispose(): void {
    [this.panel, this.brace, this.lockBody, this.lockShackle, this.blob].forEach((m) => m.dispose());
  }
}
