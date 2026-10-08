/**
 * The first sentence of a description, ending in a period. Tiles show just
 * this much, and the rest stays for the places with room to read it.
 */
export function firstSentence(text: string): string {
  const first = text.split('. ')[0].trim();
  return first.endsWith('.') ? first : `${first}.`;
}
