"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** Hidden input name for form submission */
  name?: string;
  /** Controlled value (YYYY-MM-DD) */
  value?: string;
  /** Default value for uncontrolled usage (YYYY-MM-DD) */
  defaultValue?: string;
  /** Called when a date is selected */
  onChange?: (date: string) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Additional class names for the trigger button */
  className?: string;
  /** HTML id for the trigger */
  id?: string;
  /** Return true for dates that should be disabled (not selectable) */
  isDisabled?: (date: string) => boolean;
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DatePicker({
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  required,
  placeholder = "Pick a date",
  className,
  id,
  isDisabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  function handleSelect(date: string) {
    if (!isControlled) {
      setInternalValue(date);
    }
    onChange?.(date);
    setOpen(false);
  }

  return (
    <>
      {name && (
        <input type="hidden" name={name} value={currentValue} />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              id={id}
              type="button"
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                !currentValue && "text-muted-foreground",
                className
              )}
            />
          }
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
          {currentValue ? formatDisplay(currentValue) : placeholder}
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" sideOffset={4}>
          <Calendar
            value={currentValue || undefined}
            onSelect={handleSelect}
            isDisabled={isDisabled}
          />
        </PopoverContent>
      </Popover>
      {required && !currentValue && (
        <input
          tabIndex={-1}
          autoComplete="off"
          className="sr-only"
          required
          value={currentValue}
          onChange={() => {}}
        />
      )}
    </>
  );
}
