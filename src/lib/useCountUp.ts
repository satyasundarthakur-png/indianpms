import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the user has asked the OS/browser to minimise motion. SSR-safe (false on the server). */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Animates a number from its currently displayed value to `value` over `duration` ms.
 * Used for the headline metric tiles so the dashboard feels alive without
 * pulling in a general-purpose animation library. Skips the animation entirely
 * when the user prefers reduced motion (CSS media queries can't stop JS-driven animation).
 */
export function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  // Tracks what is actually on screen so a retarget mid-animation continues from there.
  const displayRef = useRef(value);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
    if (reduced || duration <= 0) {
      displayRef.current = to;
      setDisplay(to);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      const next = t >= 1 ? to : from + (to - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return display;
}
