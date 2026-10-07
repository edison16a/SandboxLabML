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
 * The part of a box's span that lies on screen. On a phone the side panel
 * reaches past the bottom of the window, so a target scrolled into the box
 * could still sit below the screen.
 */
export function onScreen(start: number, end: number, viewEnd: number): [number, number] {
  return [Math.max(start, 0), Math.min(end, viewEnd)];
}

/** Cuts a scroll step down to what the box can still scroll, so the boxes further out know how far the target really moved. */
export function clampScroll(step: number, at: number, max: number): number {
  return Math.min(Math.max(at + step, 0), max) - at;
}

/**
 * Scrolls the boxes around a step's target until it shows on screen, like
 * a toolbar that scrolls sideways on a phone and hides its last buttons.
 * The nearest box goes first. When it cannot scroll far enough, as with a
 * side panel that reaches below a phone screen, the boxes further out take
 * the rest. The page itself never scrolls.
 */
export function revealTarget(selector: string, smooth: boolean): void {
  const el = document.querySelector(selector);
  if (!el) return;
  const r = el.getBoundingClientRect();
  // How far the boxes already scrolled have moved the target.
  let movedX = 0;
  let movedY = 0;
  for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
    const style = getComputedStyle(box);
    const sideways = /auto|scroll/.test(style.overflowX) && box.scrollWidth > box.clientWidth;
    const down = /auto|scroll/.test(style.overflowY) && box.scrollHeight > box.clientHeight;
    if (!sideways && !down) continue;
    const b = box.getBoundingClientRect();
    const wantX = sideways ? scrollNeeded(r.left - movedX, r.right - movedX, ...onScreen(b.left, b.right, window.innerWidth)) : 0;
    const wantY = down ? scrollNeeded(r.top - movedY, r.bottom - movedY, ...onScreen(b.top, b.bottom, window.innerHeight)) : 0;
    const left = clampScroll(wantX, box.scrollLeft, box.scrollWidth - box.clientWidth);
    const top = clampScroll(wantY, box.scrollTop, box.scrollHeight - box.clientHeight);
    if (left || top) box.scrollBy({ left, top, behavior: smooth ? 'smooth' : 'auto' });
    movedX += left;
    movedY += top;
  }
}
