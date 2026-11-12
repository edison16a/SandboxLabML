import { bodyStrip } from './body';
import { addDoors } from './doors';
import { mirrorParts } from './mirror';
import { lightest, type Detail, type PartBin } from './parts';
import { ARCH, AXLES } from './profile';

/**
 * The bright strip along the top of the sill cladding, between the arch
 * flares: across it, (share of the cladding band, lift off it), a slim
 * rounded bead that catches the sky along its top. It makes the black
 * base read as trim on the body rather than as shadow under it.
 */
const ACCENT: Array<[number, number]> = [[0.885, 0.0008], [0.91, 0.0026], [0.94, 0.0034], [0.965, 0.0026], [0.98, 0.0008]];
const ACCENT_FAR: Array<[number, number]> = [[0.885, 0.0015], [0.98, 0.0015]];
/** Where the strip runs, m: from the rear flare's front edge to the front flare's back edge. */
const ACCENT_RUN = { rear: AXLES[1] + ARCH.radius + 0.05, front: AXLES[0] - ARCH.radius - 0.05 };

/**
 * Side detail: the cladding's bright strip, the mirrors, and on the
 * followed SUV the doors' shut lines and handles (doors.ts).
 */
export function addSides(bin: PartBin, detail: Detail): void {
  if (!lightest(detail)) bin.add('metal', bodyStrip(0, detail.fine ? ACCENT : ACCENT_FAR, ACCENT_RUN.rear, ACCENT_RUN.front, detail.fine ? 24 : 4));
  const m = mirrorParts(detail);
  bin.add('paint', m.cap);
  bin.add('trim', m.arm);
  if (!detail.fine) {
    m.glass.dispose();
    return;
  }
  // Dark mirror glass: chrome would read as a bright button from the chase camera.
  bin.add('glass', m.glass);
  addDoors(bin);
}
