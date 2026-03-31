"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency, formatPeriod, isValidToolOutput, type CategorySummary } from "./format";

interface CategorySummaryConfig {
  title: string;
  route: string;
  totalField: string;
  colorClass: string;
}

export function CategorySummaryCard({
  output,
  config,
}: {
  output: unknown;
  config: CategorySummaryConfig;
}) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("categories" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as Record<string, unknown> & {
    period: { startDate: string; endDate: string };
    categories: CategorySummary[];
    currency?: string;
  };

  const total = (data[config.totalField] as number) ?? 0;
  const cur = data.currency;

  if (data.categories.length === 0) return null;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push(config.route)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatPeriod(data.period)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`text-2xl font-bold tabular-nums ${config.colorClass}`}>
          {formatCurrency(total, cur)}
        </div>
        <div className="space-y-2.5">
          {data.categories.map((c) => {
            const pct = total > 0 ? (c.total / total) * 100 : 0;
            return (
              <div key={c.category}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{c.category}</span>
                  <span className="tabular-nums text-muted-foreground ml-2 shrink-0">
                    {formatCurrency(c.total, cur)}
                    <span className="text-xs ml-1">
                      {Math.round(pct)}%
                    </span>
                  </span>
                </div>
                <ProgressBar
                  value={pct}
                  className="overflow-hidden mt-1.5"
                  barClassName={`${config.colorClass.replace("text-", "bg-")}/60`}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
