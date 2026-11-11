import * as THREE from 'three';
import { hash, pixelTexture } from './pixels';

/**
 * What a forged wheel looks like spinning faster than the eye can follow:
 * the spokes smear into a translucent graphite disc with faint concentric
 * rings where their edges and the bolt circle run round, a darker hub, and
 * a clear ring at the edge so the polished lip still shows. Drawn over the
 * spokes and faded in with speed, it replaces the strobing a camera at 60
 * frames per second would otherwise catch.
 */
export function wheelBlurMap(size: number): THREE.DataTexture {
  const t = pixelTexture('wheel-blur', size, true, (x, y, out) => {
    const u = ((x + 0.5) / size) * 2 - 1;
    const v = ((y + 0.5) / size) * 2 - 1;
    const r = Math.hypot(u, v);
    // Rings in the smear: brighter where the spoke faces run, darker over the gaps between them.
    const rings = 0.5 + 0.5 * Math.sin(r * 46) * Math.sin(r * 13 + 1.3);
    const grain = hash(Math.round(r * size * 0.7), 0, 5) * 0.12;
    let c = 34 + rings * 16 + grain * 60;
    let a = 0.82;
    if (r < 0.26) {
      // Hub and nut: solid and dark.
      c = 26 + grain * 40;
      a = 0.94;
    } else if (r > 0.9) {
      // Fade out over the lip so the rim edge stays crisp.
      a = 0.82 * Math.max(0, 1 - (r - 0.9) / 0.1);
    }
    out[0] = c;
    out[1] = c;
    out[2] = c + 3;
    out[3] = r > 1 ? 0 : Math.round(a * 255);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
