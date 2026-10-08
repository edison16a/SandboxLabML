import * as THREE from 'three';

/**
 * A full screen pass that scales what a pane has drawn, color and alpha
 * alike, by `uKeep`. The canvas is transparent and premultiplied, so a
 * pane drawn at 40% shows the poster under it at 60%: the live scene
 * fades in over its still frame inside one canvas, pane by pane.
 */
export interface PaneFade {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  keep: { value: number };
  dispose: () => void;
}

export function createPaneFade(): PaneFade {
  const keep = { value: 1 };
  const material = new THREE.ShaderMaterial({
    uniforms: { uKeep: keep },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uKeep; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, uKeep); }',
    // dst = dst * srcAlpha, for color and alpha: a plain multiply of what is already there.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.SrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return {
    scene,
    camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    keep,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
