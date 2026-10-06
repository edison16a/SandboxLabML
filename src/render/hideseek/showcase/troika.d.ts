/**
 * The one troika-three-text call the showcase makes. The package comes in
 * with drei's Text and ships no type declarations of its own.
 */
declare module 'troika-three-text' {
  export function configureTextBuilder(config: { useWorker?: boolean; defaultFontURL?: string | null; sdfGlyphSize?: number }): void;
}
