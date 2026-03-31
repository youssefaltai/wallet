"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
}

interface BudgetStatusData {
  budgets: BudgetStatus[];
  message?: string;
}

export function BudgetStatusCard({ output }: { output: unknown }) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("budgets" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as BudgetStatusData;

  if (data.budgets.length === 0) return null;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {data.budgets.map((budget) => {
        const barColor =
          budget.percentUsed >= 90
            ? "bg-negative"
            : budget.percentUsed >= 75
              ? "bg-warning"
              : "bg-positive";

        return (
          <Card
            key={budget.id}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => router.push("/budgets")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {budget.name}
              </CardTitle>
              {budget.categoryName && (
                <Badge variant="secondary">{budget.categoryName}</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">
                  {budget.spentFormatted}
                </span>
                <span className="text-sm text-muted-foreground">
                  of {budget.budgetAmountFormatted}
                </span>
              </div>
              <ProgressBar
                value={budget.percentUsed}
                className="overflow-hidden"
                barClassName={`${barColor} transition-all`}
              />
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>
                  {budget.remaining >= 0
                    ? `${budget.remainingFormatted} left`
                    : `${formatCurrency(Math.abs(budget.remaining))} over`}
                  {" · "}
                  {Math.round(budget.percentUsed)}% used
                </span>
                <span>
                  {formatPeriod({ startDate: budget.startDate, endDate: budget.endDate })}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
