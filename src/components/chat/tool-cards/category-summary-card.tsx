import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency, formatPeriod, isValidToolOutput, type CategorySummary } from "./format";

interface CategorySummaryConfig {
  totalField: string;
  colorClass: string;
  emptyMessage: string;
}

export function CategorySummaryCard({
  output,
  config,
}: {
  output: unknown;
  config: CategorySummaryConfig;
}) {
  if (!output || typeof output !== "object") return null;
  if (!("categories" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as Record<string, unknown> & {
    period: { startDate: string; endDate: string };
    categories: CategorySummary[];
  };

  const total = (data[config.totalField] as number) ?? 0;

  if (data.categories.length === 0) {
    return (
      <Card size="sm" className="max-w-sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {config.emptyMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" className="max-w-sm">
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {formatPeriod(data.period)}
          </p>
          <p className={`text-lg font-semibold tabular-nums ${config.colorClass}`}>
            {formatCurrency(total)}
          </p>
        </div>
        <div className="space-y-2">
          {data.categories.map((c) => {
            const pct = total > 0 ? (c.total / total) * 100 : 0;
            return (
              <div key={c.category}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{c.category}</span>
                  <span className="tabular-nums text-muted-foreground ml-2 shrink-0">
                    {formatCurrency(c.total)}
                    <span className="text-xs ml-1">
                      {Math.round(pct)}%
                    </span>
                  </span>
                </div>
                <ProgressBar
                  value={pct}
                  className="h-1 overflow-hidden mt-1"
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
