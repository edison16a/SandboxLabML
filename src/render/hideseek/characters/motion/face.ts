import { clamp } from '@/engine/core/math';
import { EXPRESSIONS, type CharacterPose, type Expression } from './pose';
import { approach } from './spring';

/** Lids (upper shut, lower raised, 0 to 1) and eye and pupil size for each mood. */
const EYES: Record<Expression, { upper: number; lower: number; eye: number; pupil: number }> = {
  happy: { upper: 0.12, lower: 0.28, eye: 1, pupil: 1 },
  sleep: { upper: 1, lower: 0.25, eye: 1, pupil: 1 },
  startled: { upper: -0.08, lower: 0, eye: 1.14, pupil: 0.72 },
  keen: { upper: 0.4, lower: 0.22, eye: 1, pupil: 1.08 },
  effort: { upper: 0.36, lower: 0.42, eye: 0.96, pupil: 1 },
};

/** What the face reacts to this frame. */
export interface FaceInput {
  frozen: boolean;
  seen: boolean;
  seeing: boolean;
  /** Pushing or carrying a box: a strained, determined face. */
  straining: boolean;
  /** Where it wants to look, relative to the head, rad, and how much. */
  lookYaw: number;
  lookPitch: number;
  looking: number;
  time: number;
  seed: number;
  dt: number;
}

/** A repeatable pseudo random 0 to 1 from a number, for blink timing and glances that differ per character. */
function noise(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The face: big eyes whose pupils dart to whatever the agent looks at
 * (with small idle glances), lids that blink every few seconds and on a
 * sudden look, and a mouth that eases from one mood to the next. Startled
 * eyes open wide with small pupils, keen ones narrow, a strain squints and
 * sleep shuts them.
 */
export class FaceDynamics {
  private nextBlink = 1.5;
  private blinkAt = -1;
  private glanceAt = 0;
  private glanceYaw = 0;
  private glancePitch = 0;
  private lastLook = 0;

  update(f: FaceInput, pose: CharacterPose): void {
    const dt = f.dt;
    const mood: Expression = f.frozen ? 'sleep' : f.seen ? 'startled' : f.seeing ? 'keen' : f.straining ? 'effort' : 'happy';
    let top = 0;
    for (let i = 0; i < EXPRESSIONS.length; i++) {
      pose.mouth[i] = approach(pose.mouth[i], EXPRESSIONS[i] === mood ? 1 : 0, 14, dt);
      if (pose.mouth[i] > pose.mouth[top]) top = i;
    }
    const eyes = EYES[mood];
    pose.awake = approach(pose.awake, f.frozen ? 0 : 1, f.frozen ? 2.5 : 6, dt);
    // A blink every few seconds, and one when the gaze jumps far, like a real glance.
    const look = f.lookYaw * f.looking;
    if (Math.abs(look - this.lastLook) > 0.5 && f.time - this.blinkAt > 0.6) this.blinkAt = f.time;
    this.lastLook = look;
    if (f.time > this.nextBlink) {
      this.blinkAt = f.time;
      this.nextBlink = f.time + 2.2 + 3 * noise(f.time * 0.37 + f.seed * 3.1);
    }
    const sinceBlink = f.time - this.blinkAt;
    const blink = sinceBlink >= 0 && sinceBlink < 0.14 ? Math.sin((sinceBlink / 0.14) * Math.PI) : 0;
    pose.lidUpper = Math.max(approach(pose.lidUpper, eyes.upper, 16, dt), blink * (1 - eyes.lower * 0.3));
    pose.lidLower = approach(pose.lidLower, eyes.lower, 16, dt);
    pose.eyeScale = approach(pose.eyeScale, eyes.eye, 18, dt);
    pose.pupilScale = approach(pose.pupilScale, eyes.pupil, 18, dt);
    // Idle glances: a new small look somewhere every second or two when nothing holds its attention.
    if (f.time > this.glanceAt) {
      this.glanceAt = f.time + 0.8 + 1.6 * noise(f.time + f.seed * 7.7);
      this.glanceYaw = (noise(f.time * 1.3 + f.seed) - 0.5) * 0.6;
      this.glancePitch = (noise(f.time * 2.1 + f.seed * 5) - 0.5) * 0.25;
    }
    const idle = 1 - f.looking;
    pose.gazeYaw = approach(pose.gazeYaw, clamp(f.lookYaw * f.looking + this.glanceYaw * idle, -0.5, 0.5), 30, dt);
    pose.gazePitch = approach(pose.gazePitch, clamp(f.lookPitch * f.looking + this.glancePitch * idle, -0.35, 0.35), 30, dt);
    pose.glow = approach(pose.glow, f.seen ? 1.6 + 0.4 * Math.sin(f.time * 12) : f.seeing ? 1.45 : 1, 8, dt);
    pose.ring = approach(pose.ring, f.frozen ? 0.12 : f.seeing ? 1.6 : 1, 6, dt);
    pose.expression = EXPRESSIONS[top];
  }
}
