"use client";

import { useCallback } from "react";
import { CountUp } from "@/components/shared/count-up";

export function NetWorthValue({
  value,
  currency,
}: {
  value: number;
  currency: string;
}) {
  const format = useCallback(
    (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(n),
    [currency],
  );

  return (
    <div className="text-2xl font-bold">
      <CountUp value={value} format={format} />
    </div>
  );
}
