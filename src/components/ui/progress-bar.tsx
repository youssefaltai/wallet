"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  barClassName?: string;
}

export function ProgressBar({ value, className, barClassName }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Delay to trigger the CSS transition from 0 -> target
    const id = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className={cn("h-2 rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-700 ease-out",
          barClassName,
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
