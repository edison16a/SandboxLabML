import type * as THREE from 'three';
import { bothSides, merge, mirrorZ } from '../suv/geometry/grid';
import type { TrafficDetail } from './body/detail';
import { doorMirror, roofSign } from './body/fittings';
import { Imprint } from './body/imprint';
import { wheelLiners } from './body/liners';
import { Projector } from './body/project';
import { floatDecal, ringDecal } from './body/overlay';
import { outlineLoop } from './body/region';
import { buildShell } from './body/shell';
import { bakeLook, LAMP, type Look } from './looks';
import type { CarShape } from './shape/types';

/** The shell's panels in order: black lower trim, lower side, everything above the shoulder. */
const PANEL_LOOKS: Look[] = ['plastic', 'paint', 'paint'];

/**
 * How far floating pieces and window frames stand off the paint, m. Enough
 * to clear the depth buffer's steps at street distances, too little to see.
 */
const FLOAT_LIFT = 0.004;
const RING_LIFT = 0.004;
/**
 * A frame is thin, so it costs two triangles a point; drawing its outline
 * three times finer than the glass keeps its chords from dipping under
 * the paint where the body curves, as it does over a windshield header.
 */
const RING_DENSITY = 3;

/** The right half's copy of the left: its indicators are the right indicators. */
function mirrorHalf(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = mirrorZ(g);
  const lamp = m.attributes.lamp;
  for (let i = 0; i < lamp.count; i++) {
    const v = lamp.getX(i);
    if (v === LAMP.left) lamp.setX(i, LAMP.right);
    else if (v === LAMP.right) lamp.setX(i, LAMP.left);
  }
  return m;
}

/**
 * One traffic car body with every look baked into vertex attributes, so a
 * whole body type draws in one instanced call. The left half of the shell
 * is lofted, then glass, lamps, grilles and lines are stamped flush into
 * it from flat drawings, and the half is mirrored. Liners, mirrors and the
 * cab's sign finish it. `misses` counts outline points with no body under
 * them (tests keep it at zero).
 */
export function buildTrafficBody(s: CarShape, d: TrafficDetail): { geometry: THREE.BufferGeometry; misses: number } {
  const shell = buildShell(s, d);
  const proj = new Projector(shell.panels);
  const imprint = new Imprint();
  shell.panels.forEach((g, p) => imprint.add(g, PANEL_LOOKS[p]));
  imprint.add(shell.underbody, 'well');
  let misses = 0;
  const laid: THREE.BufferGeometry[] = [];
  for (const decal of s.decals) {
    if (decal.fine && !d.fine) continue;
    const nu = Math.max(1, Math.round(decal.cells[0] * d.cells));
    const nv = Math.max(1, Math.round(decal.cells[1] * d.cells));
    const lamp = decal.lamp ?? LAMP.none;
    if (decal.kind === 'float' || decal.kind === 'ring') {
      const out = decal.kind === 'float' ? floatDecal(proj, decal.region, nu, nv, FLOAT_LIFT) : ringDecal(proj, decal.region, nu * RING_DENSITY, nv * RING_DENSITY, decal.grow ?? 0.02, RING_LIFT);
      misses += out.misses;
      laid.push(bakeLook(out.geometry, [decal.look], lamp));
      continue;
    }
    const { loop, misses: lost } = outlineLoop(proj, decal.region, nu, nv, decal.grow);
    misses += lost;
    imprint.stamp(loop, decal.region.view, decal.look, lamp);
  }
  const half = merge([imprint.geometry(), ...laid]);
  laid.forEach((g) => g.dispose());
  const parts = [half, mirrorHalf(half), bothSides(bakeLook(wheelLiners(s, d.arch), ['well'])), bothSides(doorMirror(s, proj, d.fine))];
  if (s.roofSign) parts.push(roofSign(s, proj));
  shell.panels.forEach((g) => g.dispose());
  shell.underbody.dispose();
  const geometry = merge(parts);
  parts.forEach((p) => p.dispose());
  geometry.computeBoundingSphere();
  return { geometry, misses };
}

/** The body geometry alone, for the instanced meshes. */
export function carBodyGeometry(s: CarShape, d: TrafficDetail): THREE.BufferGeometry {
  return buildTrafficBody(s, d).geometry;
}
