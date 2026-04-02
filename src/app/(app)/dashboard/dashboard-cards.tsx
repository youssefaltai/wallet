"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AnimateIn } from "@/components/shared/animate-in";
import { formatDateFull, formatDateRange } from "@/lib/utils/format-date";
import type { AccountWithBalance } from "@/lib/services/accounts";
import type { BudgetStatus } from "@/lib/services/budgets";
import type { GoalWithProgress } from "@/lib/services/goals";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Bank & Cash",
  liability: "Credit & Loans",
};

// ── Account Cards ───────────────────────────────────────────────────────

export function DashboardAccountCards({
  accounts,
  baseDelay,
}: {
  accounts: AccountWithBalance[];
  baseDelay: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function transactionsUrl(accountId: string) {
    const params = new URLSearchParams();
    params.set("account", accountId);
    const date = searchParams.get("date");
    if (date) params.set("date", date);
    return `/transactions?${params.toString()}`;
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {accounts.map((account, i) => (
        <AnimateIn key={account.id} delay={baseDelay + i * 50}>
          <Card
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => router.push(transactionsUrl(account.id))}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {account.name}
              </CardTitle>
              <Badge variant="secondary">
                {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {account.balanceFormatted}
              </div>
              {account.institution && (
                <p className="text-xs text-muted-foreground mt-1">
                  {account.institution}
                </p>
              )}
            </CardContent>
          </Card>
        </AnimateIn>
      ))}
    </div>
  );
}

// ── Budget Cards ────────────────────────────────────────────────────────

export function DashboardBudgetCards({
  budgets,
  baseDelay,
}: {
  budgets: BudgetStatus[];
  baseDelay: number;
  currency?: string;
}) {
  const router = useRouter();

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {budgets.map((budget, i) => {
        const barColor =
          budget.percentUsed >= 90
            ? "bg-negative"
            : budget.percentUsed >= 75
              ? "bg-warning"
              : "bg-positive";

        return (
          <AnimateIn key={budget.id} delay={baseDelay + i * 50}>
            <Card
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
                      : `${new Intl.NumberFormat("en-US", { style: "currency", currency: budget.currency }).format(Math.abs(budget.remaining))} over`}
                    {" \u00B7 "}
                    {Math.round(budget.percentUsed)}% used
                  </span>
                  <span>
                    {formatDateRange(budget.startDate, budget.endDate)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </AnimateIn>
        );
      })}
    </div>
  );
}

// ── Goal Cards ──────────────────────────────────────────────────────────

export function DashboardGoalCards({
  goals,
  baseDelay,
}: {
  goals: GoalWithProgress[];
  baseDelay: number;
}) {
  const router = useRouter();

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {goals.map((goal, i) => (
        <AnimateIn key={goal.id} delay={baseDelay + i * 50}>
          <Card
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => router.push("/goals")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium truncate">
                {goal.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">
                  {goal.currentAmountFormatted}
                </span>
                <span className="text-sm text-muted-foreground">
                  of {goal.targetAmountFormatted}
                </span>
              </div>
              <ProgressBar
                value={goal.progressPercent}
                className="mt-3 overflow-hidden"
                barClassName="bg-primary transition-all"
              />
              <p className="mt-1 text-xs text-muted-foreground text-right">
                {goal.progressPercent}%
              </p>
              {goal.deadline && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Deadline:{" "}
                  {formatDateFull(goal.deadline)}
                </p>
              )}
            </CardContent>
          </Card>
        </AnimateIn>
      ))}
    </div>
  );
}
