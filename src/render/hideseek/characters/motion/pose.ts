import { RIG } from '../rig/proportions';
import { vec3, type Vec3 } from './vec';

/** The moods a face can show. Each has its own mouth; the eyes blend between them. */
export type Expression = 'happy' | 'sleep' | 'startled' | 'keen' | 'effort';
export const EXPRESSIONS: readonly Expression[] = ['happy', 'sleep', 'startled', 'keen', 'effort'];

/**
 * Everything the character mesh needs to pose itself, recomputed every
 * frame by CharacterMotion. Points are in the character's own frame (x
 * ahead, y up from the ground under it, z to its right); angles in rad.
 */
export interface CharacterPose {
  /** The body's root at the hip line, and its lean (top forward), roll (top to the right), twist (about y) and vertical squash. */
  pelvis: Vec3;
  lean: number;
  roll: number;
  twist: number;
  squash: number;
  /** The head turned on the body: yaw left positive, pitch down positive, roll. */
  headYaw: number;
  headPitch: number;
  headRoll: number;
  /** Leg joints, left then right, and each foot's heading (relative to the body) and toe pitch. */
  hips: [Vec3, Vec3];
  knees: [Vec3, Vec3];
  ankles: [Vec3, Vec3];
  footYaw: [number, number];
  footPitch: [number, number];
  /** Arm joints, left then right. */
  shoulders: [Vec3, Vec3];
  elbows: [Vec3, Vec3];
  hands: [Vec3, Vec3];
  /** Where the pupils look, relative to the head, and how far the lids are shut (0 open, 1 shut). */
  gazeYaw: number;
  gazePitch: number;
  lidUpper: number;
  lidLower: number;
  eyeScale: number;
  pupilScale: number;
  /** How much of each expression's mouth shows, in EXPRESSIONS order. */
  mouth: Float32Array;
  /** 0 asleep to 1 awake: dims the body and shows the sleeping face. */
  awake: number;
  /** Strength of the light inside the body: up when seen or seeing. */
  glow: number;
  /** Strength of the glowing ring at a seeker's feet. */
  ring: number;
  /** The face shown most right now. */
  expression: Expression;
}

const pair = (): [Vec3, Vec3] => [vec3(), vec3()];

export function createPose(): CharacterPose {
  return {
    pelvis: vec3(0, RIG.hipY, 0),
    lean: 0,
    roll: 0,
    twist: 0,
    squash: 1,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    hips: pair(),
    knees: pair(),
    ankles: pair(),
    footYaw: [0, 0],
    footPitch: [0, 0],
    shoulders: pair(),
    elbows: pair(),
    hands: pair(),
    gazeYaw: 0,
    gazePitch: 0,
    lidUpper: 0,
    lidLower: 0,
    eyeScale: 1,
    pupilScale: 1,
    mouth: new Float32Array(EXPRESSIONS.length),
    awake: 1,
    glow: 1,
    ring: 0,
    expression: 'happy',
  };
}
