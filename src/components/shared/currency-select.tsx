"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_LIST } from "@/lib/constants/currencies";
import { useCurrency } from "@/components/providers/currency-provider";

export function CurrencySelect({
  name = "currency",
  id,
  value: controlledValue,
  defaultValue,
  onChange,
}: {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
}) {
  const baseCurrency = useCurrency();
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? baseCurrency,
  );

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) {
          if (!isControlled) setInternalValue(v);
          onChange?.(v);
        }
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="!max-h-48">
        {CURRENCY_LIST.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.code} — {c.name}
          </SelectItem>
        ))}
      </SelectContent>
      <input type="hidden" name={name} value={value} />
    </Select>
  );
}
