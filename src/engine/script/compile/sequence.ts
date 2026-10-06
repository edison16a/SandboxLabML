import type { Exec } from './frame';

const noop: Exec = () => false;

/** Longest run of statements chained in one closure. Longer blocks become a small tree of these. */
const GROUP = 8;

/**
 * Chains statements so they run in order and stop at the first one that
 * fired a stop. Compiled closures are created many times over a run, and V8
 * does not inline those, so every closure boundary is a real call. One
 * closure per group of up to eight statements keeps the number of calls per
 * tick close to the number of statements.
 */
export function sequence(list: readonly Exec[]): Exec {
  if (list.length > GROUP) {
    const groups: Exec[] = [];
    for (let i = 0; i < list.length; i += GROUP) groups.push(sequence(list.slice(i, i + GROUP)));
    return sequence(groups);
  }
  const [a, b, c, d, e, f, g, h] = list;
  switch (list.length) {
    case 0:
      return noop;
    case 1:
      return a;
    case 2:
      return (v, io) => a(v, io) || b(v, io);
    case 3:
      return (v, io) => a(v, io) || b(v, io) || c(v, io);
    case 4:
      return (v, io) => a(v, io) || b(v, io) || c(v, io) || d(v, io);
    case 5:
      return (v, io) => a(v, io) || b(v, io) || c(v, io) || d(v, io) || e(v, io);
    case 6:
      return (v, io) => a(v, io) || b(v, io) || c(v, io) || d(v, io) || e(v, io) || f(v, io);
    case 7:
      return (v, io) => a(v, io) || b(v, io) || c(v, io) || d(v, io) || e(v, io) || f(v, io) || g(v, io);
    default:
      return (v, io) => a(v, io) || b(v, io) || c(v, io) || d(v, io) || e(v, io) || f(v, io) || g(v, io) || h(v, io);
  }
}
