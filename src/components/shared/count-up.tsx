"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}

export function CountUp({
  value,
  format,
  duration = 1200,
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(format(0));
  const ref = useRef<number | null>(null);
  const formatRef = useRef(format);
  useLayoutEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(formatRef.current(to));
      return;
    }

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;

      setDisplay(formatRef.current(current));

      if (progress < 1) {
        ref.current = requestAnimationFrame(tick);
      }
    }

    ref.current = requestAnimationFrame(tick);

    return () => {
      if (ref.current != null) cancelAnimationFrame(ref.current);
    };
  }, [value, format, duration]);

  return <span className={className}>{display}</span>;
}
