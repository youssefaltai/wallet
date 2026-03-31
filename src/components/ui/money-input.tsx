"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Formats a numeric string with commas as thousands separators.
 * Preserves trailing decimal point and partial cents during editing.
 */
function formatWithCommas(raw: string): string {
  if (!raw) return "";

  // Split on decimal
  const parts = raw.split(".");
  const intPart = parts[0] ?? "";
  const decPart = parts.length > 1 ? parts[1] : undefined;

  // Add commas to integer portion
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decPart !== undefined) {
    return `${formatted}.${decPart}`;
  }
  // Preserve trailing decimal point while typing
  if (raw.endsWith(".")) {
    return `${formatted}.`;
  }
  return formatted;
}

/**
 * Strips commas and validates that the string is a valid decimal number
 * with at most 2 decimal places.
 */
function sanitize(input: string): string {
  // Remove everything except digits and decimal point
  let cleaned = input.replace(/[^0-9.]/g, "");

  // Only allow one decimal point
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1) {
    cleaned =
      cleaned.slice(0, dotIndex + 1) +
      cleaned.slice(dotIndex + 1).replace(/\./g, "");
  }

  // Limit to 2 decimal places
  if (dotIndex !== -1 && cleaned.length - dotIndex - 1 > 2) {
    cleaned = cleaned.slice(0, dotIndex + 3);
  }

  // Remove leading zeros (but keep "0" and "0.")
  if (cleaned.length > 1 && cleaned[0] === "0" && cleaned[1] !== ".") {
    cleaned = cleaned.replace(/^0+/, "") || "0";
  }

  return cleaned;
}

interface MoneyInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "type" | "value" | "defaultValue" | "onChange"
  > {
  /** The form field name. A hidden input with this name carries the raw numeric value. */
  name: string;
  /** Currency symbol to show as prefix. Defaults to "$". */
  currency?: string;
  /** Controlled raw numeric value (e.g. "1234.56"). */
  value?: string;
  /** Uncontrolled initial raw numeric value. */
  defaultValue?: string;
  /** Called when the raw numeric value changes. */
  onChange?: (value: string) => void;
}

function MoneyInput({
  name,
  currency = "$",
  value: controlledValue,
  defaultValue,
  onChange,
  className,
  id,
  placeholder = "0.00",
  required,
  disabled,
  "aria-invalid": ariaInvalid,
  ...rest
}: MoneyInputProps) {
  const isControlled = controlledValue !== undefined;

  const [internalValue, setInternalValue] = React.useState(() => {
    if (defaultValue) return sanitize(defaultValue);
    return "";
  });

  const rawValue = isControlled ? controlledValue : internalValue;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = sanitize(e.target.value);
    if (!isControlled) {
      setInternalValue(cleaned);
    }
    onChange?.(cleaned);
  }

  return (
    <div className="relative">
      {/* Currency symbol prefix */}
      <span
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground select-none text-sm"
        aria-hidden="true"
      >
        {currency}
      </span>

      {/* Visible formatted input */}
      <input
        {...rest}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        data-slot="input"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent pl-7 pr-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        placeholder={placeholder}
        value={formatWithCommas(rawValue)}
        onChange={handleChange}
        required={required}
        disabled={disabled}
        aria-invalid={ariaInvalid}
      />

      {/* Hidden input carries the raw numeric value for form submission */}
      <input type="hidden" name={name} value={rawValue} />
    </div>
  );
}

export { MoneyInput };
