"use client";

import { useEffect, useState } from "react";

/**
 * Returns `false` during the server render and the first client render, then
 * `true` after mount.
 *
 * Use it to gate values that cannot be produced identically on the server and
 * the client — the current time, `Math.random()`, `window`/`localStorage`
 * reads — so the first client render matches the server HTML. Rendering such a
 * value during the initial render instead throws React hydration error #418.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount flag; a mounted-only value cannot be produced during render
    setMounted(true);
  }, []);

  return mounted;
}
