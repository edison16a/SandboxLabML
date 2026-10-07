import * as THREE from 'three';
import { HS, HS_COLORS } from '../palette';
import type { CharacterPose } from './motion/pose';
import { seekerRingMaterial } from './seekerRing';
import type { CharacterDetail, CharacterTeam } from './types';

/**
 * Body color per team: a saturated glossy blue and red, deeper than the
 * theme's UI tokens, because lit 3D color washes out toward white on the
 * bright floor where a flat UI swatch does not.
 */
export const TEAM_BODY: Record<CharacterTeam, THREE.Color> = { hider: new THREE.Color(HS_COLORS.hiderBody), seeker: new THREE.Color(HS_COLORS.seekerBody) };
/** The light inside a body is its team color washed this far toward white. */
const GLOW_WASH = 0.3;
const WHITE = new THREE.Color('#ffffff');
/** Opacity of the blob shadow under a character standing on the floor. */
const BLOB_OPACITY = 0.42;
/** The ring takes the seeker red, pushed past 1 so bloom catches it. */
const RING = new THREE.Color(HS_COLORS.seekerBody).multiplyScalar(1.6);

/**
 * Adds a soft light inside the body and a bright rim: a little glow where
 * the surface faces the viewer, where a gummy body is thickest, and a
 * stronger, whiter rim where light would scatter out at the edges. That
 * rim is what lifts the characters off the pale floor. Works on the
 * standard and the physical material alike, skinned or not.
 */
function addInnerGlow(material: THREE.MeshStandardMaterial, uniforms: { uGlowColor: { value: THREE.Color }; uGlow: { value: number } }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowColor = uniforms.uGlowColor;
    shader.uniforms.uGlow = uniforms.uGlow;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uGlowColor;\nuniform float uGlow;').replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        float rim = pow(1.0 - facing, 2.2);
        totalEmissiveRadiance += uGlowColor * uGlow * (0.12 * facing + 1.8 * rim);
      }`,
    );
  };
  material.customProgramCacheKey = () => 'hs-character-glow';
}

/**
 * The materials of one character. They are its own, not shared, because
 * the glow, the sleepy fade and the ring change per character every frame;
 * they still share shader programs with every other character.
 */
export class CharacterMaterials {
  readonly body: THREE.MeshStandardMaterial;
  readonly face: THREE.MeshStandardMaterial;
  readonly blob: THREE.MeshBasicMaterial;
  readonly ring: THREE.ShaderMaterial;
  private readonly tint: THREE.Color;
  private readonly uniforms = { uGlowColor: { value: new THREE.Color() }, uGlow: { value: 1 } };

  constructor(team: CharacterTeam, detail: CharacterDetail, blobMap: THREE.Texture) {
    this.tint = TEAM_BODY[team].clone();
    this.uniforms.uGlowColor.value.copy(this.tint).lerp(WHITE, GLOW_WASH);
    this.body =
      detail === 'full'
        ? new THREE.MeshPhysicalMaterial({ color: this.tint, vertexColors: true, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.1 })
        : new THREE.MeshStandardMaterial({ color: this.tint, vertexColors: true, roughness: 0.28, metalness: 0, envMapIntensity: 1.1 });
    addInnerGlow(this.body, this.uniforms);
    this.face = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0, envMapIntensity: 1.2 });
    this.blob = new THREE.MeshBasicMaterial({ color: HS_COLORS.blobShadow, alphaMap: blobMap, transparent: true, opacity: BLOB_OPACITY, depthWrite: false });
    this.ring = seekerRingMaterial(RING);
  }

  /** Follows the pose: the sleepy fade, the glow that rises when seen or seeing, and the ring. `height` (m) fades the floor shadow of a climber or a jumper. */
  apply(pose: CharacterPose, height: number, time: number): void {
    this.blob.opacity = BLOB_OPACITY * Math.max(0.2, 1 - height * 0.32);
    const sleepy = 1 - pose.awake;
    this.body.color.copy(this.tint).lerp(HS.dormant, sleepy * 0.5);
    this.uniforms.uGlow.value = pose.glow * (1 - sleepy * 0.8);
    this.ring.uniforms.uStrength.value = pose.ring * Math.max(0, 1 - height * 1.5);
    this.ring.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.body.dispose();
    this.face.dispose();
    this.blob.dispose();
    this.ring.dispose();
  }
}
