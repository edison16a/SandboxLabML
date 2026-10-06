/** Generations where the champion is benchmarked: 0, every, 2 * every and so on, up to the last one. */
export function checkpoints(generations: number, every: number): number[] {
  const out: number[] = [];
  for (let g = 0; g <= generations; g += every) out.push(g);
  return out;
}
