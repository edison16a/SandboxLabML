import * as THREE from 'three';

/** Skin tones from fair to deep, in sRGB. */
const SKIN = ['#f1d3bd', '#e6b896', '#d39c76', '#b57b55', '#8d5b3d', '#5e3c28'];
/** What people wear on top: lots of white, grey, navy and black, some color. */
const SHIRTS = ['#eeeeea', '#d8d6cf', '#9aa0a6', '#2c3442', '#1b1d22', '#41618d', '#7d2f2f', '#c8693a', '#5f7a52', '#b89f6e', '#6c4f7d', '#d9c46a', '#e4e1d8', '#38404a'];
/** Trousers and skirts: denim, black, khaki, grey. */
const PANTS = ['#2f4363', '#3c5476', '#1c1d21', '#2a2b30', '#7c705a', '#5d5f63', '#a39a85', '#43393a'];
const HAIR = ['#141110', '#2b1d14', '#4a3020', '#7a5232', '#b08a55', '#8e8a84', '#6b2e1d'];

const toLinear = (list: string[]) => list.map((c) => new THREE.Color(c));
const palettes = { skin: toLinear(SKIN), shirt: toLinear(SHIRTS), pants: toLinear(PANTS), hair: toLinear(HAIR) };

/** One person's colors and build, from their look code (0 to 255). */
export interface PersonLook {
  skin: THREE.Color;
  shirt: THREE.Color;
  pants: THREE.Color;
  hair: THREE.Color;
  /** Overall scale: shorter and taller adults. */
  scale: number;
}

/**
 * A stable look per code: the same person keeps their clothes every
 * frame and on every machine. Codes mix through small primes so
 * neighbors in the crowd never dress alike.
 */
export function personLook(code: number): PersonLook {
  const pick = <T>(list: T[], k: number) => list[(code * k + (code >> 3)) % list.length];
  return {
    skin: pick(palettes.skin, 7),
    shirt: pick(palettes.shirt, 11),
    pants: pick(palettes.pants, 5),
    hair: pick(palettes.hair, 13),
    scale: 0.92 + ((code * 29) % 17) / 100,
  };
}

/** Looks for all 256 codes, built once. */
export const LOOKS: readonly PersonLook[] = Array.from({ length: 256 }, (_, i) => personLook(i));
