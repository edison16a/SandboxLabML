import type { ReactNode } from 'react';
import type { Side } from './placement';

/** A technical word a step uses, with its plain meaning shown under the text. */
export interface Term {
  term: string;
  meaning: string;
}

/** What a step shows: its words and the part of the page it frames. */
export interface StepText {
  title: string;
  body: string;
  terms?: Term[];
  /**
   * CSS selector of the part to frame, usually a data-tour attribute. When it
   * matches several elements the frame covers every visible one. Leave it
   * out to frame nothing and center the card.
   */
  target?: string;
  /** Framed instead when `target` shows nothing, like a counter a narrow toolbar hides. */
  fallback?: string;
  /** Sides of the frame the card tries first. */
  prefer?: Side[];
}

/** Something a step asks the user to do. Next stays available the whole time. */
export interface StepAction {
  /** The instruction, like "Press Train". */
  prompt: string;
  /** Keyboard shortcut shown beside the instruction. */
  shortcut?: string;
  /** Read a few times a second while the step is open. True once the user has done it. */
  done: () => boolean;
  /** A short confirmation once it is done, like "Training". */
  doneLabel: string;
  /** What the step says while the result plays out. Its target defaults to the step's own. */
  then: StepText;
}

export interface WalkStep extends StepText {
  id: string;
  /** The part of the story the step belongs to, shown above its title. */
  chapter?: string;
  action?: StepAction;
  /** Puts the page in the state the step talks about, like the right tab being open. */
  prepare?: () => void;
  /** Where to go next, shown on the last step. */
  links?: Array<{ label: string; href: string }>;
}

/** A chapter as the welcome card lists it. Its label matches the `chapter` of its steps. */
export interface Chapter {
  label: string;
  icon: ReactNode;
}

export interface Tour {
  id: string;
  /** localStorage key that is set to "1" once the tour was finished or skipped. */
  storageKey: string;
  intro: { title: string; body: string; icon: ReactNode; chapters: Chapter[] };
  steps: WalkStep[];
  /**
   * True while the lab has its own use for Escape, like backing out of a
   * followed car. Escape then goes to the lab instead of skipping the tour.
   */
  pageOwnsEscape?: () => boolean;
}
