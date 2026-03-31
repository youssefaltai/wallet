"use client";

import { useState } from "react";
import { ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  /** Hidden input name for form submission */
  name?: string;
  /** Controlled value (HH:mm, 24-hour) */
  value?: string;
  /** Default value for uncontrolled usage (HH:mm, 24-hour) */
  defaultValue?: string;
  /** Called when time changes */
  onChange?: (time: string) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Placeholder text when no time is selected */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** HTML id */
  id?: string;
}

function formatDisplay(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function TimePicker({
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  required,
  placeholder = "Pick a time",
  className,
  id,
}: TimePickerProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!isControlled) {
      setInternalValue(val);
    }
    onChange?.(val);
  }

  return (
    <div className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={currentValue} />}
      <div className="relative">
        <ClockIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type="time"
          value={currentValue}
          onChange={handleChange}
          required={required}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-xs transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
            !currentValue && "text-muted-foreground",
          )}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
