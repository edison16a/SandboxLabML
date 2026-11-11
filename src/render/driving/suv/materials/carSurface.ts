import type * as THREE from 'three';

/** A ghost's rim, in its own color: brightest where the surface turns away from the viewer. */
const GHOST_RIM = `
float ghostRim = pow( 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 ), 2.0 );
totalEmissiveRadiance += vColor.rgb * ghostRim * 0.55;`;

/**
 * Lets one instanced draw call show a whole car's worth of materials. The
 * crowd car stores, per vertex, a color and a `surface` vec4: roughness,
 * metalness, glow and tint. The shader reads those instead of the
 * material's single values, applies the instance color only where tint is
 * 1 (the paint), and adds the untinted color as light where glow is set
 * (the lamps). If the material has a clear coat, it covers surfaces with
 * a roughness of 0.4 or less, like the paint and glass, and fades out by
 * 0.5, so tires and liners stay matte.
 *
 * Ghosts set `ghost`: the instance color then washes over the whole car,
 * full strength on the paint and dimmer elsewhere, so a translucent ghost
 * reads as one colored shape instead of a smoky dark one. Its surface is
 * satin rather than glass, and a rim of its own color lights and firms up
 * its outline, so it reads as a solid spectral shell, not as tinted glass
 * with the road showing through.
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
    const roughness = ghost ? 'max( vSurface.x, 0.5 )' : 'vSurface.x';
    const metalness = ghost ? '0.0' : 'vSurface.y';
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
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = ${roughness};`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = ${metalness};`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vRawColor * vSurface.z;${ghost ? GHOST_RIM : ''}`)
      // The coat is set inside this chunk, and includes are not expanded yet here, so scale it right after.
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n  material.clearcoat *= clamp( ( 0.5 - vSurface.x ) * 10.0, 0.0, 1.0 );\n#endif');
    // The rim also stands firmer: alpha rises toward the outline, up to solid.
    if (ghost) shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor.a *= vInstanceOpacity;', 'gl_FragColor.a = min( 1.0, gl_FragColor.a * vInstanceOpacity * ( 1.0 + 1.2 * ghostRim ) );');
  };
  material.customProgramCacheKey = () => `${key()}|car-surface${ghost ? '-ghost' : ''}`;
  return material;
}
