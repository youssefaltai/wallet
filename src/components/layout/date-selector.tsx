"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  CalendarIcon,
} from "lucide-react";
import { getCurrentDate, navigateDay } from "@/lib/utils/date";
import { formatDate } from "@/lib/utils/format-date";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";

export function DateSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = getCurrentDate();
  const date = searchParams.get("date") ?? today;
  const isToday = date === today;

  function setDate(newDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (newDate === today) {
      params.delete("date");
    } else {
      params.set("date", newDate);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleCalendarSelect(selectedDate: string) {
    setDate(selectedDate);
    setCalendarOpen(false);
  }

  return (
    <div className="flex items-center gap-1">
      {!isToday && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDate(today)}
          className="mr-1 gap-1 text-xs"
        >
          <RotateCcwIcon />
          Today
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setDate(navigateDay(date, -1))}
        aria-label="Previous day"
      >
        <ChevronLeftIcon />
      </Button>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer min-w-[8.5rem] ${
                isToday ? "text-foreground" : "text-primary"
              }`}
            />
          }
        >
          <CalendarIcon className="size-3.5" />
          {formatDate(date)}
        </PopoverTrigger>
        <PopoverContent align="center" side="bottom" sideOffset={8}>
          <Calendar value={date} onSelect={handleCalendarSelect} />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setDate(navigateDay(date, 1))}
        aria-label="Next day"
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
