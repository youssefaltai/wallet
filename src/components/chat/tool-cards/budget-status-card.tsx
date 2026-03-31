import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency, formatPeriod, isValidToolOutput } from "./format";

interface BudgetStatus {
  id: string;
  name: string;
  categoryName: string | null;
  budgetAmount: number;
  budgetAmountFormatted: string;
  spent: number;
  spentFormatted: string;
  remaining: number;
  remainingFormatted: string;
  percentUsed: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface BudgetStatusData {
  budgets: BudgetStatus[];
  message?: string;
}

export function BudgetStatusCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("budgets" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as BudgetStatusData;

  if (data.budgets.length === 0) {
    return (
      <Card size="sm" className="max-w-sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {data.message ?? "No budgets set up."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" className="max-w-sm">
      <CardContent className="space-y-4">
        {data.budgets.map((b) => {
          const barColor =
            b.percentUsed >= 90
              ? "bg-negative"
              : b.percentUsed >= 75
                ? "bg-warning"
                : "bg-positive";

          return (
            <div key={b.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <div>
                  <span className="font-medium">{b.name}</span>
                  {b.categoryName && (
                    <span className="text-muted-foreground text-xs ml-1.5">
                      {b.categoryName}
                    </span>
                  )}
                </div>
                <span className="tabular-nums text-muted-foreground text-xs shrink-0 ml-3">
                  {formatCurrency(b.spent)} / {formatCurrency(b.budgetAmount)}
                </span>
              </div>
              <ProgressBar
                value={b.percentUsed}
                className="h-1 overflow-hidden"
                barClassName={`${barColor} transition-all`}
              />
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-muted-foreground">
                  {b.remaining >= 0
                    ? `${formatCurrency(b.remaining)} left`
                    : `${formatCurrency(Math.abs(b.remaining))} over`}
                  {" · "}
                  {Math.round(b.percentUsed)}% used
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPeriod({ startDate: b.startDate, endDate: b.endDate })}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
