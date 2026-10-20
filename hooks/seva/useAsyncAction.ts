"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MIN_PENDING_MS } from "@/lib/seva/motion";

export interface AsyncAction<A extends unknown[], R> {
  /** Runs the action. Ignored (resolves to undefined) while a run is pending; a failure resolves to undefined too. */
  run: (...args: A) => Promise<R | undefined>;
  /** True from the click itself (before any await) until the action settles, and for at least MIN_PENDING_MS. */
  pending: boolean;
  /** The last run's failure, cleared when a new run starts. */
  error: Error | null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an async action for a button: instant pending feedback, no double submit, no flicker (plan A4P-1).
 * The latest `fn` is always the one run, so callers may pass an inline function.
 */
export function useAsyncAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>): AsyncAction<A, R> {
  const fnRef = useRef(fn);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    if (busy.current) return undefined;
    busy.current = true;
    setPending(true);
    setError(null);
    const started = Date.now();
    try {
      return await fnRef.current(...args);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    } finally {
      const left = MIN_PENDING_MS - (Date.now() - started);
      if (left > 0) await wait(left);
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  return { run, pending, error };
}

export default useAsyncAction;
