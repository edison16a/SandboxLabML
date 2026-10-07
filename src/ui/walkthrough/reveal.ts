/** Room left between a revealed target and the edge of the box it scrolls in. */
const MARGIN = 12;

/** How far a box has to scroll along one axis so the span from `start` to `end` fits inside it. */
export function scrollNeeded(start: number, end: number, boxStart: number, boxEnd: number): number {
  if (end - start > boxEnd - boxStart) return start - boxStart - MARGIN;
  if (start < boxStart) return start - boxStart - MARGIN;
  if (end > boxEnd) return end - boxEnd + MARGIN;
  return 0;
}

/**
 * Scrolls the boxes around a step's target until it shows, like a toolbar
 * that scrolls sideways on a phone and hides its last buttons. Only boxes
 * that scroll on purpose move, never the page frame around them.
 */
export function revealTarget(selector: string, smooth: boolean): void {
  const el = document.querySelector(selector);
  for (let box = el?.parentElement; el && box && box !== document.body; box = box.parentElement) {
    const style = getComputedStyle(box);
    const sideways = /auto|scroll/.test(style.overflowX) && box.scrollWidth > box.clientWidth;
    const down = /auto|scroll/.test(style.overflowY) && box.scrollHeight > box.clientHeight;
    if (!sideways && !down) continue;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const left = sideways ? scrollNeeded(r.left, r.right, b.left, b.right) : 0;
    const top = down ? scrollNeeded(r.top, r.bottom, b.top, b.bottom) : 0;
    if (left || top) box.scrollBy({ left, top, behavior: smooth ? 'smooth' : 'auto' });
    // The nearest scrolling box is the one that hides it. The boxes further out are left alone.
    return;
  }
}
