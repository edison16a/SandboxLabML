import { allowedDistance, editDistance } from './distance';

export interface Suggestion {
  name: string;
  /** Lower is better. Case slips score 0.5, a matching last part of a dotted name scores 0.75 more than its edits. */
  distance: number;
}

/**
 * Close matches for a misspelled name, best first. Case slips count as
 * nearly free ("car.offtrack" finds "car.offTrack"), and a bare last part
 * finds the full dotted name ("speed" finds "car.speed").
 */
export function suggest(word: string, candidates: Iterable<string>, limit = 3): Suggestion[] {
  const max = allowedDistance(word);
  const lower = word.toLowerCase();
  const found = new Map<string, number>();
  for (const name of candidates) {
    if (name === word || found.has(name)) continue;
    const nameLower = name.toLowerCase();
    let best = Infinity;
    if (nameLower === lower) best = 0.5;
    else {
      const d = editDistance(lower, nameLower, max);
      if (d <= max) best = d;
    }
    if (!word.includes('.') && name.includes('.')) {
      const tail = editDistance(lower, nameLower.slice(nameLower.lastIndexOf('.') + 1), max);
      if (tail <= max) best = Math.min(best, tail + 0.75);
    }
    if (best < Infinity) found.set(name, best);
  }
  return [...found]
    .map(([name, distance]) => ({ name, distance }))
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** The single best suggestion when it clearly beats the rest, otherwise null. */
export function bestSuggestion(word: string, candidates: Iterable<string>): string | null {
  const list = suggest(word, candidates, 2);
  if (list.length === 0) return null;
  if (list.length > 1 && list[1].distance === list[0].distance) return null;
  return list[0].name;
}
