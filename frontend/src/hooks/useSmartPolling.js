import { useEffect, useRef } from "react";

export function useSmartPolling(load, intervalMs, options = {}) {
  const { enabled = true, immediate = true } = options;
  const loadRef = useRef(load);
  const runningRef = useRef(false);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    const run = async (allowHidden = false) => {
      if (cancelled || runningRef.current) return;
      if (!allowHidden && typeof document !== "undefined" && document.hidden) return;

      runningRef.current = true;
      try {
        await loadRef.current();
      } finally {
        runningRef.current = false;
      }
    };

    if (immediate) run(true);

    const timer = setInterval(() => run(false), intervalMs);
    const handleVisibility = () => {
      if (!document.hidden) run(true);
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, immediate, intervalMs]);
}
