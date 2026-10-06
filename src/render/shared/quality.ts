import type { QualityTier } from '@/features/racing/state/labStore';

/** Pixel ratio cap per tier. Pixel ratio is the first thing to drop on a cheaper tier. */
export function tierDpr(tier: QualityTier): [number, number] {
  if (tier === 'low') return [1, 1];
  if (tier === 'medium') return [1, 1.5];
  return [1, 2];
}

/**
 * Rough guess at a weak GPU from the WebGL renderer string. Integrated GPUs
 * start on Medium, and until someone picks a quality the Hide and Seek grid
 * caps at 25 arenas on them.
 */
export function isIntegratedGpu(gl: WebGL2RenderingContext | WebGLRenderingContext): boolean {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
  if (name.includes('apple')) return false;
  return /intel|swiftshader|llvmpipe|mali|adreno|powervr|software/.test(name);
}

let probed: boolean | null = null;

/**
 * Asks a throwaway WebGL context which GPU this is, once per page load, so
 * the default quality is known before a lab creates its own canvas. A
 * browser without WebGL counts as weak.
 */
export function probeWeakGpu(): boolean {
  if (probed !== null) return probed;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    probed = gl ? isIntegratedGpu(gl) : true;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    probed = true;
  }
  return probed;
}
