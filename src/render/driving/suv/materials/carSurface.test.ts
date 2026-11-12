import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFadeMaterial } from '@/render/shared/fadeMaterial';
import { withCarSurface } from './carSurface';

type Shader = Parameters<THREE.Material['onBeforeCompile']>[0];

/**
 * Runs a material's shader patch on three's own sources, which still hold
 * their #include lines at this point, just as the renderer does. A replace
 * whose target is missing changes nothing and raises no error, so the
 * tests look for every line each patch should add.
 */
function patch(material: THREE.Material, lib: 'standard' | 'physical'): Shader {
  const shader = { vertexShader: THREE.ShaderLib[lib].vertexShader, fragmentShader: THREE.ShaderLib[lib].fragmentShader, uniforms: {} } as unknown as Shader;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

const SURFACE_VERTEX = ['attribute vec4 surface;', 'vSurface = surface;', 'vRawColor = vColor.rgb;'];
const SURFACE_FRAGMENT = ['float roughnessFactor = vSurface.x;', 'float metalnessFactor = vSurface.y;', 'totalEmissiveRadiance += vRawColor * vSurface.z;', 'material.clearcoat *='];

function expectAll(source: string, lines: string[]): void {
  for (const line of lines) expect(source, line).toContain(line);
}

describe('car surface shader patch', () => {
  it('patches the clear coated crowd material, coat mask included', () => {
    const shader = patch(withCarSurface(new THREE.MeshPhysicalMaterial({ vertexColors: true, clearcoat: 1 })), 'physical');
    expectAll(shader.vertexShader, SURFACE_VERTEX);
    expectAll(shader.fragmentShader, SURFACE_FRAGMENT);
  });

  it('patches the standard crowd material used below High', () => {
    const shader = patch(withCarSurface(new THREE.MeshStandardMaterial({ vertexColors: true })), 'standard');
    expectAll(shader.vertexShader, SURFACE_VERTEX);
    expectAll(shader.fragmentShader, SURFACE_FRAGMENT);
  });

  it('stacks on the ghost fade without losing either patch', () => {
    const shader = patch(withCarSurface(createFadeMaterial({ vertexColors: true }), { ghost: true }), 'standard');
    expectAll(shader.vertexShader, [...SURFACE_VERTEX, 'attribute float instanceOpacity;', 'vInstanceOpacity = instanceOpacity;', 'instanceColor.rgb * mix( 0.45, 1.0, surface.w )']);
    // A ghost is satin with a firm rim: no mirror finish, and alpha rises toward the outline.
    expectAll(shader.fragmentShader, ['float roughnessFactor = max( vSurface.x, 0.5 );', 'float metalnessFactor = 0.0;', 'totalEmissiveRadiance += vRawColor * vSurface.z;', 'float ghostRim', 'vInstanceOpacity * ( 1.0 + 1.2 * ghostRim )']);
  });
});
