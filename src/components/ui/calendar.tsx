"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatISODate } from "@/lib/utils/date";

interface CalendarProps {
  /** Selected date as YYYY-MM-DD */
  value?: string;
  /** Called when a date is selected */
  onSelect?: (date: string) => void;
  /** Return true for dates that should be disabled (not selectable) */
  isDisabled?: (date: string) => boolean;
  className?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function Calendar({ value, onSelect, isDisabled, className }: CalendarProps) {
  const today = formatISODate(new Date());

  // The month being viewed (not necessarily the selected date's month)
  const [viewDate, setViewDate] = React.useState(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // Update view when value changes externally
  React.useEffect(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      setViewDate(new Date(y, m - 1, 1));
    }
  }, [value]);

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  // Build the grid of days
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthLabel = firstDay.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  return (
    <div className={cn("w-[280px] select-none", className)}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={prevMonth}
          aria-label="Previous month"
        >
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={nextMonth}
          aria-label="Next month"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }

          const dateStr = formatISODate(
            new Date(viewYear, viewMonth, day)
          );
          const isSelected = dateStr === value;
          const isToday = dateStr === today;
          const disabled = isDisabled?.(dateStr) ?? false;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect?.(dateStr)}
              className={cn(
                "flex items-center justify-center h-9 w-full rounded-md text-sm transition-colors",
                disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected &&
                  !disabled &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                !isSelected &&
                  !disabled &&
                  isToday &&
                  "bg-accent/50 font-semibold"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
