import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute float aRadial;
attribute float aFloor;
uniform float uHeight;
varying float vRadial;
varying float vFloor;
varying float vHeight;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vRadial = aRadial;
  vFloor = aFloor;
  vHeight = position.y / uHeight;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vRadial;
varying float vFloor;
varying float vHeight;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vec3 toEye = cameraPosition - vWorld;
  float eyeDistance = length(toEye);
  // Fresnel: faces seen edge on glow, faces seen head on stay clear, so the volume reads as a shell.
  float facing = abs(dot(normalize(vNormalW), toEye / eyeDistance));
  float fresnel = pow(1.0 - facing, 2.2);
  // Fades out toward the end of the vision range and toward the top of the wedge.
  float radial = 1.0 - smoothstep(0.25, 1.0, vRadial);
  float top = 1.0 - smoothstep(0.5, 1.0, vHeight);
  // Depth fade: thins out close to the camera so a camera inside the cone sees no hard plane.
  float near = smoothstep(0.4, 3.0, eyeDistance);
  float shell = (0.06 + 0.75 * fresnel) * top * (1.0 - vFloor);
  float pool = vFloor * 0.26 * pow(1.0 - vRadial, 1.3);
  float a = (shell + pool) * radial * near * uOpacity;
  gl_FragColor = vec4(uColor, min(a, 0.85));
  #include <colorspace_fragment>
}
`;

/**
 * The seeker's vision cone material: a see through shell with a fresnel
 * edge, a soft pool of color on the floor and fades toward the range limit
 * and near the camera. Plain alpha blending, since added light would vanish
 * on the pale floor; colors skip tone mapping so the red stays true.
 */
export function createConeMaterial(color: THREE.Color, height: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uColor: { value: color.clone() }, uOpacity: { value: 1 }, uHeight: { value: height } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
