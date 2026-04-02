"use client";

import { useCallback } from "react";
import { CountUp } from "@/components/shared/count-up";

export function NetWorthValue({
  value,
  currency,
  isApproximate = false,
  ratesFetchedAt = null,
}: {
  value: number;
  currency: string;
  isApproximate?: boolean;
  ratesFetchedAt?: Date | null;
}) {
  const format = useCallback(
    (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(n),
    [currency],
  );

  const ratesDate = ratesFetchedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(ratesFetchedAt)
    : null;

  return (
    <div className="space-y-1">
      <div className="text-3xl font-bold">
        {isApproximate && (
          <span className="text-muted-foreground mr-0.5">~</span>
        )}
        <CountUp value={value} format={format} />
      </div>
      {isApproximate && ratesDate && (
        <p className="text-xs text-muted-foreground">
          Approximate &mdash; rates from {ratesDate}
        </p>
      )}
    </div>
  );
}
