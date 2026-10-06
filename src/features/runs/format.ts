/** "3 min ago", "yesterday", or a date for anything older than a week. */
export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return 'yesterday';
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Days left before a trashed run is purged. */
export function daysLeft(deletedAt: number, windowDays: number, now = Date.now()): number {
  return Math.max(0, Math.ceil(windowDays - (now - deletedAt) / 86400000));
}
