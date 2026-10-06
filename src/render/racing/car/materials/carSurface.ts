import type * as THREE from 'three';

/**
 * Lets one instanced draw call show a whole car's worth of materials. The
 * crowd car stores, per vertex, a color and a `surface` vec4: roughness,
 * metalness, glow and tint. The shader reads those instead of the
 * material's single values, applies the instance color only where tint is
 * 1 (the paint), and adds the untinted color as light where glow is set
 * (the lamps). Smooth surfaces also pick up the clear coat, if the
 * material has one.
 *
 * Ghosts set `ghost`: the instance color then washes over the whole car,
 * full strength on the paint and dimmer elsewhere, so a translucent ghost
 * reads as one colored shape instead of a smoky dark one.
 *
 * Any onBeforeCompile already on the material still runs first, so this
 * stacks on the ghosts' per-instance fade.
 */
export function withCarSurface<T extends THREE.MeshStandardMaterial>(material: T, { ghost = false } = {}): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  const tinted = ghost ? 'instanceColor.rgb * mix( 0.45, 1.0, surface.w )' : 'vColor.rgb * mix( vec3( 1.0 ), instanceColor.rgb, surface.w )';
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 surface;\nvarying vec4 vSurface;\nvarying vec3 vRawColor;')
      .replace(
        '#include <color_vertex>',
        [
          'vColor = vec4( 1.0 );',
          '#ifdef USE_COLOR',
          '  vColor.rgb *= color;',
          '#endif',
          'vRawColor = vColor.rgb;',
          '#ifdef USE_INSTANCING_COLOR',
          `  vColor.rgb = ${tinted};`,
          '#endif',
          'vSurface = surface;',
        ].join('\n'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vSurface;\nvarying vec3 vRawColor;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurface.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurface.y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vRawColor * vSurface.z;')
      .replace('material.clearcoat = clearcoat;', 'material.clearcoat = clearcoat * clamp( ( 0.5 - vSurface.x ) * 2.5, 0.0, 1.0 );');
  };
  material.customProgramCacheKey = () => `${key()}|car-surface${ghost ? '-ghost' : ''}`;
  return material;
}
