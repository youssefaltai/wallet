"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentDate } from "@/lib/utils/date";
import { formatDateFull } from "@/lib/utils/format-date";

export function DateBanner() {
  const searchParams = useSearchParams();
  const today = getCurrentDate();
  const date = searchParams.get("date");

  const isActive = Boolean(date && date !== today);
  const [displayDate, setDisplayDate] = useState(date);
  const [visible, setVisible] = useState(isActive);
  const prevActive = useRef(isActive);

  // Keep the displayed date text until the exit animation completes
  useEffect(() => {
    if (isActive) {
      // Schedule state updates asynchronously to avoid synchronous setState in effect
      queueMicrotask(() => {
        setDisplayDate(date);
        requestAnimationFrame(() => setVisible(true));
      });
    } else if (prevActive.current) {
      // Start exit transition; displayDate stays so text doesn't vanish mid-fade
      queueMicrotask(() => setVisible(false));
    }
    prevActive.current = isActive;
  }, [isActive, date]);

  // Don't render anything until the banner has been needed at least once
  if (!isActive && !displayDate) return null;

  return (
    <div
      className="grid transition-all duration-300 ease-in-out"
      style={{
        gridTemplateRows: visible ? "1fr" : "0fr",
        opacity: visible ? 1 : 0,
      }}
      onTransitionEnd={() => {
        // After exit animation completes, clear the stale date
        if (!visible) setDisplayDate(null);
      }}
    >
      <div className="overflow-hidden">
        <div className="border-b border-warning/30 bg-warning/10 px-6 py-2 text-center text-sm text-warning">
          Viewing{" "}
          <span className="font-semibold">
            {displayDate ? formatDateFull(displayDate) : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
