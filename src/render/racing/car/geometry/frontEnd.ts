import * as THREE from 'three';
import { capDecals, type Pt } from './decals';
import { bothSides } from './grid';
import type { Detail, PartBin } from './parts';

/** A disc of `r` meters on the nose, for the projector lamps. */
const dot = (z: number, y: number, r: number, sides: number): Pt[] => Array.from({ length: sides }, (_, i) => [z + Math.cos((i / sides) * Math.PI * 2) * r, y + Math.sin((i / sides) * Math.PI * 2) * r]);

/**
 * The nose: painted corners with big angular intakes, a carbon center
 * panel with its own intake, Y shaped daytime running lights over the side
 * intakes and slim projector lamps in a dark glass housing.
 */
export function addFront(bin: PartBin, detail: Detail): void {
  const { shape, strip } = capDecals(1, detail.fine);
  // A carbon panel down the middle of the painted nose, under the hood's leading edge.
  const panel: Pt[] = [[0.335, 0.12], [0.375, 0.34], [0.325, 0.474], [0, 0.522], [-0.325, 0.474], [-0.375, 0.34], [-0.335, 0.12]];
  bin.add('carbon', shape(panel, 0.003));
  const center: Pt[] = [[0.29, 0.152], [0.32, 0.29], [0.235, 0.35], [0, 0.358], [-0.235, 0.35], [-0.32, 0.29], [-0.29, 0.152]];
  bin.add('grille', shape(center, 0.006));

  // Side intakes cut into the painted corners, outlined in gold along the bottom and outer edge.
  const side: Pt[] = [[0.405, 0.15], [0.635, 0.142], [0.69, 0.27], [0.655, 0.37], [0.44, 0.383], [0.39, 0.29]];
  bin.add('grille', bothSides(shape(side, 0.004)));
  bin.add('gold', bothSides(strip([0.4, 0.138], [0.64, 0.13], 0.008, 0.006)));
  bin.add('gold', bothSides(strip([0.64, 0.13], [0.7, 0.268], 0.008, 0.006)));

  // Headlight housing: dark glass under the fender's leading edge, two projector lamps inside.
  const housing: Pt[] = [[0.43, 0.392], [0.664, 0.382], [0.676, 0.4], [0.645, 0.478], [0.47, 0.468]];
  bin.add('glass', bothSides(shape(housing, 0.005)));
  const sides = detail.fine ? 14 : 6;
  bin.add('led', bothSides(shape(dot(0.535, 0.437, 0.017, sides), 0.008)));
  bin.add('led', bothSides(shape(dot(0.6, 0.433, 0.017, sides), 0.008)));

  // The Y: one arm runs inboard along the top of the intake, one climbs the fender corner, one drops down its outer edge.
  const joint: Pt = [0.668, 0.385];
  const w = 0.016;
  bin.add('led', bothSides(strip(joint, [0.4, 0.393], w, 0.009)));
  bin.add('led', bothSides(strip(joint, [0.652, 0.494], w, 0.009)));
  bin.add('led', bothSides(strip(joint, [0.714, 0.262], w, 0.009)));
}

/**
 * The splitter: a carbon plate that runs out ahead of the nose, its front
 * edge following the nose's curve in plan.
 */
export function addSplitter(bin: PartBin, detail: Detail): void {
  const plan = new THREE.Shape();
  const steps = detail.fine ? 16 : 6;
  for (let i = 0; i <= steps; i++) {
    const z = -0.8 + (1.6 * i) / steps;
    const x = 2.22 - 0.15 * (z / 0.8) ** 2;
    if (i === 0) plan.moveTo(x, z);
    else plan.lineTo(x, z);
  }
  plan.lineTo(1.95, 0.8);
  plan.lineTo(1.95, -0.8);
  const bevel = detail.fine ? 0.006 : 0;
  const g = new THREE.ExtrudeGeometry(plan, { depth: 0.03 - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 });
  // The plan is drawn in (x, z); turning it flat makes the extrusion run downward from y = 0.
  g.rotateX(Math.PI / 2).translate(0, 0.118 - bevel, 0);
  bin.add('carbon', g);
}
