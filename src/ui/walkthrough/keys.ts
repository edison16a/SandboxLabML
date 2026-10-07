/** What a key does to the tour. */
export type WalkMove = 'next' | 'back' | 'skip';

/** Where a key landed, as far as the tour cares. */
export interface KeySpot {
  /** A button, link or tab has focus, so Enter should press it. */
  onControl: boolean;
  /** Focus sits in a widget the arrows move through, like a tab list or a slider. */
  inArrowWidget: boolean;
  /** The page has something Escape backs out of, like a car the camera follows. */
  pageOwnsEscape: boolean;
}

/**
 * Right or Enter goes on, Left goes back and Escape skips. The page keeps
 * the keys it needs: Enter presses a focused control, and the arrows keep
 * moving through tab lists, toggle groups and sliders. Those are the only
 * way to reach a tab like Network from the keyboard. Escape stays with the
 * page while it has something to back out of, so one natural press does
 * not end a first visit's tour for good.
 */
export function walkMove(key: string, spot: KeySpot): WalkMove | null {
  if (key === 'ArrowRight') return spot.inArrowWidget ? null : 'next';
  if (key === 'ArrowLeft') return spot.inArrowWidget ? null : 'back';
  if (key === 'Enter') return spot.onControl ? null : 'next';
  if (key === 'Escape') return spot.pageOwnsEscape ? null : 'skip';
  return null;
}

const CONTROL = 'button, a[href], [role="tab"], [role="radio"], [role="menuitem"], [role="switch"]';

/** Widgets with roving focus or a value the arrows change. Radix toggle groups are role="group". */
const ARROW_WIDGET = '[role="tablist"], [role="radiogroup"], [role="group"], [role="toolbar"], [role="slider"], [role="separator"], [role="menu"], [role="menubar"], [role="listbox"]';

/** Reads where a key event landed. */
export function keySpot(target: EventTarget | null, pageOwnsEscape: boolean): KeySpot {
  const el = target instanceof Element ? target : null;
  return { onControl: !!el?.closest(CONTROL), inArrowWidget: !!el?.closest(ARROW_WIDGET), pageOwnsEscape };
}
