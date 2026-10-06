/**
 * Decides which display frames draw under a frame rate cap. requestAnimationFrame
 * fires on every display frame; one draws once it is close enough to the next
 * due time, and the due time then steps by exactly one interval. Stepping
 * from the due time rather than from the frame keeps the average on the cap
 * at any refresh rate, so 60 on a 144 Hz screen alternates gaps of two and
 * three frames instead of settling at 48.
 */
export function createPacer(fps: number): (t: number) => boolean {
  const interval = 1000 / fps;
  // Frame timestamps jitter by a millisecond or two. Without slack a 60 cap on a 60 Hz screen would drop frames.
  const slack = interval / 4;
  let due = -Infinity;
  return (t) => {
    if (t < due - slack) return false;
    // After a stall (a hidden tab, a long task) start over rather than rush to catch up.
    due = t - due > interval ? t + interval : due + interval;
    return true;
  };
}
