import { useEffect, useMemo, type DependencyList } from 'react';

interface Disposable {
  dispose(): void;
}

/**
 * useMemo for GPU resources: the value is disposed when the deps change or
 * the component unmounts, so editing a track never leaks geometry.
 */
export function useDisposable<T extends Disposable | null>(factory: () => T, deps: DependencyList): T {
  // The caller owns the deps list, exactly like useMemo itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const value = useMemo(factory, deps);
  useEffect(() => () => value?.dispose(), [value]);
  return value;
}
