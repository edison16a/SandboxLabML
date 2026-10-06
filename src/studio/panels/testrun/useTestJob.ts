import { useEffect, useRef, useState } from 'react';

export type TestFailure = { ok: false; message: string };

/**
 * One test at a time, cancellable. Starting a new test aborts the one in
 * flight, and leaving the tab aborts whatever is running, which terminates
 * its worker. A cancelled test leaves the last result in place.
 */
export function useTestJob<R>() {
  const [result, setResult] = useState<R | TestFailure | null>(null);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const start = async (work: (signal: AbortSignal) => Promise<R | TestFailure>) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setRunning(true);
    try {
      setResult(await work(ctrl.signal));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (abort.current === ctrl) setRunning(false);
    }
  };
  const cancel = () => {
    abort.current?.abort();
    setRunning(false);
  };
  return { result, running, start, cancel };
}
