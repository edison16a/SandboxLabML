/**
 * The project's writing rules for anything a learner reads: no dashes used
 * as punctuation, no arrows standing in for words, no dots or bullets in
 * the middle of a sentence. Content is checked in tests, so a lesson that
 * slips one in fails before it ships.
 */
const RULES: ReadonlyArray<{ pattern: RegExp; problem: string }> = [
  { pattern: /[\u2014\u2013]/, problem: 'uses an em or en dash' },
  { pattern: /--/, problem: 'uses a double hyphen' },
  { pattern: /\s-\s/, problem: 'uses a dash as punctuation' },
  { pattern: /[\u2190-\u21ff]|->|=>/, problem: 'uses an arrow in place of words' },
  { pattern: /[\u00b7\u2022\u2027\u22c5]/, problem: 'uses a midline dot or bullet' },
];

/** Problems with one piece of learner-facing text, as short phrases. Empty when it follows the rules. */
export function styleProblems(text: string): string[] {
  return RULES.filter((r) => r.pattern.test(text)).map((r) => r.problem);
}

/** The comment text of a script, one entry per comment line, which learners read like lesson text. */
export function scriptComments(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('//'))
    .map((line) => line.slice(2).trim());
}
