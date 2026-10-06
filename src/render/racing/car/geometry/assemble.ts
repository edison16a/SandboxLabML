import type * as THREE from 'three';
import { addArches, addUnderbody } from './arches';
import { addBody } from './body';
import { addCanopy } from './canopy';
import { addFront, addSplitter } from './frontEnd';
import { PartBin, type Detail, type Slot } from './parts';
import { addRear } from './rearEnd';
import { addSides } from './sides';
import { addWing } from './wing';

/**
 * Every part of the car that rides on the suspension, merged by material
 * slot. Wheels are built separately because they spin and steer.
 */
export function buildBody(detail: Detail): Map<Slot, THREE.BufferGeometry> {
  const bin = new PartBin();
  addBody(bin, detail);
  addArches(bin, detail);
  addUnderbody(bin);
  addCanopy(bin, detail);
  addFront(bin, detail);
  addSplitter(bin, detail);
  addRear(bin, detail);
  addSides(bin, detail);
  addWing(bin, detail);
  return bin.build();
}
