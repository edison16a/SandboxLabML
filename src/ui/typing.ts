/** True when a key event lands in a text field, where keys type text instead of driving lab shortcuts. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/**
 * True when a key event lands inside a dialog or popover of the page, like
 * New run, whose buttons own their keys. The walkthrough card is a dialog
 * too, but it says aria-modal="false" and asks for lab shortcuts like
 * Space, so keys pressed there still reach the lab.
 */
export function inDialog(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[role="dialog"]:not([aria-modal="false"]), [role="alertdialog"]');
}
