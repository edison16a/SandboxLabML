import * as THREE from 'three';
import type { CharacterPose } from './characterMotion';
import type { CharacterDetail, CharacterTeam } from './types';

/** Body tint and the color of the light inside it, per team. Blue hides, red seeks. */
export const TEAM_LOOK: Record<CharacterTeam, { body: string; glow: string }> = {
  hider: { body: '#5fbdfb', glow: '#b3e4ff' },
  seeker: { body: '#ff6b62', glow: '#ffae9c' },
};

/** A sleeping character fades toward this, so a frozen seeker reads as switched off. */
const DORMANT = new THREE.Color('#9aa0aa');

/**
 * Adds a soft light inside the body: a core glow strongest where the
 * surface faces the viewer, where a gummy body is thickest, plus a rim
 * where light would scatter out at the edges. Together they read as
 * slightly translucent without a transmission pass. Works on the standard
 * and the physical material alike.
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
        float rim = pow(1.0 - facing, 2.6);
        totalEmissiveRadiance += uGlowColor * uGlow * (0.3 * facing + 0.9 * rim);
      }`,
    );
  };
  material.customProgramCacheKey = () => 'hs-character-glow';
}

/**
 * The materials of one character. They are its own, not shared, because the
 * glow and the sleepy fade change per character every frame; they still
 * share one shader program with every other character.
 */
export class CharacterMaterials {
  readonly body: THREE.MeshStandardMaterial;
  readonly face: THREE.MeshBasicMaterial;
  readonly blob: THREE.MeshBasicMaterial;
  private readonly tint: THREE.Color;
  private readonly uniforms = { uGlowColor: { value: new THREE.Color() }, uGlow: { value: 1 } };
  private readonly glowColor: THREE.Color;

  constructor(team: CharacterTeam, detail: CharacterDetail, blobMap: THREE.Texture) {
    const look = TEAM_LOOK[team];
    this.tint = new THREE.Color(look.body);
    this.glowColor = new THREE.Color(look.glow);
    this.uniforms.uGlowColor.value.copy(this.glowColor);
    this.body =
      detail === 'full'
        ? new THREE.MeshPhysicalMaterial({ color: this.tint, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.09, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff'), envMapIntensity: 1 })
        : new THREE.MeshStandardMaterial({ color: this.tint, roughness: 0.3, metalness: 0, envMapIntensity: 1 });
    addInnerGlow(this.body, this.uniforms);
    // Pushed past 1 so bloom, where it runs, gives the face a soft halo.
    this.face = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.75, 1.8), toneMapped: false });
    this.blob = new THREE.MeshBasicMaterial({ color: '#1a1712', alphaMap: blobMap, transparent: true, opacity: 0.42, depthWrite: false });
  }

  /** Follows the pose: the sleepy fade and the glow that rises when seen or seeing. */
  apply(pose: CharacterPose): void {
    const sleepy = 1 - pose.awake;
    this.body.color.copy(this.tint).lerp(DORMANT, sleepy * 0.55);
    this.uniforms.uGlow.value = pose.glow * (1 - sleepy * 0.85);
    const f = 1.7 - sleepy * 1.05;
    this.face.color.setRGB(f, f * 1.03, f * 1.06);
  }

  dispose(): void {
    this.body.dispose();
    this.face.dispose();
    this.blob.dispose();
  }
}
